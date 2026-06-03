"""Deterministic risk rules.

Two independent rule families, both pure functions (no I/O, no state) so they
are trivially unit-testable:

  1. calculate_risk()  — absolute-threshold scoring. A faithful port of the
     dashboard's src/lib/riskEngine.ts so the backend agrees with the UI on the
     baseline. This is a SNAPSHOT judgement: "is heart rate >= 130 right now".

  2. detect_changes()  — rate-of-change / "drastic parameter change" detection.
     This is what the dashboard does NOT do: it compares the current reading
     against a recent baseline and fires when a metric moves too far, too fast.

Severity is derived from the combined score via severity_from_score().
"""

from __future__ import annotations

# Motion below this counts as immobile (matches the dashboard).
IMMOBILE_THRESHOLD = 1.5


def derive_motion_state(motion_level: float) -> str:
    if motion_level != motion_level:  # NaN
        return "unknown"
    if motion_level <= 0.5:
        return "no_motion"
    if motion_level <= 3:
        return "low_motion"
    return "active"


def severity_from_score(score: float) -> str:
    if score >= 90:
        return "CRITICAL"
    if score >= 75:
        return "HIGH"
    if score >= 45:
        return "MEDIUM"
    return "LOW"


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def calculate_risk(tracking: dict, vitals: dict, time_immobile: float):
    """Absolute-threshold scoring. Returns (score, reasons, triggers, motion_state).

    `triggers` are machine-readable codes for downstream consumers (LLM
    enrichment, robot logic); `reasons` are the human-readable sentences.
    """
    reasons: list[str] = []
    triggers: list[str] = []
    score = 0.0

    fall_probability = float(tracking.get("fallProbability", 0))
    posture = tracking.get("posture", "unknown")
    motion_level = float(tracking.get("motionLevel", 0))
    confidence = float(tracking.get("confidence", 0))
    person_detected = bool(tracking.get("personDetected", True))
    zone = str(tracking.get("zone", ""))
    distance = tracking.get("distanceFromBedMeters")

    score += fall_probability * 0.4

    if not person_detected:
        score += 12
        reasons.append("Patient tracking is temporarily lost.")
        triggers.append("TRACKING_LOST")

    if confidence < 0.55:
        score += 8
        reasons.append("Tracking confidence is low, requiring operator attention.")
        triggers.append("LOW_CONFIDENCE")

    if posture == "falling":
        score += 35
        reasons.append("Camera tracking reports a falling posture.")
        triggers.append("POSTURE_FALLING")
    elif posture == "lying":
        score += 15
        reasons.append("Patient posture is lying.")
        triggers.append("POSTURE_LYING")

    motion_state = derive_motion_state(motion_level)
    if motion_state == "no_motion":
        score += 18
        reasons.append("Motion level is near zero.")
        triggers.append("NO_MOTION")
    elif motion_state == "low_motion":
        score += 8
        reasons.append("Motion level is low.")
        triggers.append("LOW_MOTION")

    away_from_bed = isinstance(distance, (int, float)) and distance >= 1
    suspicious_immobility = away_from_bed or fall_probability >= 50 or "floor" in zone.lower()
    if time_immobile >= 45 and suspicious_immobility:
        score += 15
        reasons.append(f"Patient has been immobile for {round(time_immobile)} seconds in a risky context.")
        triggers.append("PROLONGED_IMMOBILITY")
    elif time_immobile >= 20 and suspicious_immobility:
        score += 8
        reasons.append(f"Patient has been immobile for {round(time_immobile)} seconds in a risky context.")
        triggers.append("PROLONGED_IMMOBILITY")

    if away_from_bed:
        score += 12
        reasons.append("Patient appears to be away from the bed zone.")
        triggers.append("AWAY_FROM_BED")

    if fall_probability >= 85:
        reasons.append(f"Fall probability is high ({round(fall_probability)}%).")
    elif fall_probability >= 60:
        reasons.append(f"Fall probability is elevated ({round(fall_probability)}%).")

    heart_rate = float(vitals.get("heartRate"))
    if heart_rate >= 130:
        score += 18
        reasons.append(f"Heart rate is very high ({round(heart_rate)} bpm).")
        triggers.append("HR_VERY_HIGH")
    elif heart_rate >= 115:
        score += 10
        reasons.append(f"Heart rate is elevated ({round(heart_rate)} bpm).")
        triggers.append("HR_ELEVATED")
    elif heart_rate <= 45:
        score += 15
        reasons.append(f"Heart rate is very low ({round(heart_rate)} bpm).")
        triggers.append("HR_VERY_LOW")

    temperature = float(vitals.get("temperature"))
    if temperature >= 38.5:
        score += 14
        reasons.append(f"Temperature is high ({temperature:.1f} °C).")
        triggers.append("TEMP_HIGH")
    elif temperature >= 37.8:
        score += 7
        reasons.append(f"Temperature is elevated ({temperature:.1f} °C).")
        triggers.append("TEMP_ELEVATED")
    elif temperature <= 35.5:
        score += 10
        reasons.append(f"Temperature is below expected range ({temperature:.1f} °C).")
        triggers.append("TEMP_LOW")

    spo2 = vitals.get("oxygenSaturation")
    if isinstance(spo2, (int, float)):
        if spo2 < 92:
            score += 18
            reasons.append(f"Oxygen saturation is low ({round(spo2)}%).")
            triggers.append("SPO2_LOW")
        elif spo2 < 95:
            score += 8
            reasons.append(f"Oxygen saturation needs attention ({round(spo2)}%).")
            triggers.append("SPO2_ATTENTION")

    # Strong real-case combo: possible fall away from bed + no movement after impact.
    if (
        fall_probability >= 80
        and posture in ("lying", "falling")
        and motion_state == "no_motion"
        and time_immobile >= 20
    ):
        score += 18
        reasons.append("Combined evidence indicates a possible fall with post-event immobility.")
        triggers.append("FALL_COMBINED")

    return _clamp(round(score)), reasons, triggers, motion_state


# ── Rate-of-change thresholds (the capability the dashboard lacks) ─────
# Each fires when a metric moves at least this much across the lookback window.
HR_RAPID_DELTA = 25      # bpm, rise or fall
SPO2_RAPID_DROP = 4      # percentage points, drop only
FALLPROB_SURGE = 40      # percentage points, surge only
TEMP_RAPID_RISE = 1.0    # degrees C, rise only


def detect_changes(current: dict, reference: dict, span_seconds: float):
    """Compare current metrics against a recent baseline. Returns
    (extra_score, reasons, triggers). Empty when nothing moved sharply."""
    reasons: list[str] = []
    triggers: list[str] = []
    score = 0.0
    span = round(span_seconds)

    hr_now = current.get("heartRate")
    hr_ref = reference.get("heartRate")
    if hr_now is not None and hr_ref is not None:
        delta = hr_now - hr_ref
        if abs(delta) >= HR_RAPID_DELTA:
            score += 20
            direction = "rose" if delta > 0 else "fell"
            reasons.append(f"Heart rate {direction} rapidly ({delta:+.0f} bpm in ~{span}s).")
            triggers.append("HR_RAPID_CHANGE")

    spo2_now = current.get("oxygenSaturation")
    spo2_ref = reference.get("oxygenSaturation")
    if isinstance(spo2_now, (int, float)) and isinstance(spo2_ref, (int, float)):
        drop = spo2_ref - spo2_now
        if drop >= SPO2_RAPID_DROP:
            score += 18
            reasons.append(f"Oxygen saturation dropped rapidly (-{drop:.0f} points in ~{span}s).")
            triggers.append("SPO2_RAPID_DROP")

    fp_now = current.get("fallProbability")
    fp_ref = reference.get("fallProbability")
    if fp_now is not None and fp_ref is not None:
        surge = fp_now - fp_ref
        if surge >= FALLPROB_SURGE:
            score += 20
            reasons.append(f"Fall probability surged (+{surge:.0f} points in ~{span}s).")
            triggers.append("FALLPROB_SURGE")

    temp_now = current.get("temperature")
    temp_ref = reference.get("temperature")
    if temp_now is not None and temp_ref is not None:
        rise = temp_now - temp_ref
        if rise >= TEMP_RAPID_RISE:
            score += 10
            reasons.append(f"Temperature rose rapidly (+{rise:.1f} °C in ~{span}s).")
            triggers.append("TEMP_RAPID_RISE")

    return score, reasons, triggers


def alert_title(severity: str) -> str:
    if severity == "CRITICAL":
        return "Critical patient risk derived from observation"
    if severity == "HIGH":
        return "High patient risk derived from observation"
    return "Elevated patient risk derived from observation"
