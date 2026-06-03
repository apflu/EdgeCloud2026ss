"""Deterministic unit tests for the rule families. Run: python test_rules.py

No broker or network needed — the rules are pure functions.
"""

from rules import calculate_risk, detect_changes, severity_from_score
from state import PatientState


def test_normal_patient_is_low():
    tracking = {"personDetected": True, "zone": "Bed A", "posture": "sitting",
                "motionLevel": 5.0, "fallProbability": 10, "confidence": 0.95,
                "distanceFromBedMeters": 0.2}
    vitals = {"heartRate": 78, "temperature": 36.8, "oxygenSaturation": 98}
    score, _reasons, _triggers, _motion = calculate_risk(tracking, vitals, 0)
    assert severity_from_score(score) == "LOW", score


def test_emergency_fall_is_critical():
    tracking = {"personDetected": True, "zone": "Floor Area", "posture": "lying",
                "motionLevel": 0.1, "fallProbability": 95, "confidence": 0.9,
                "distanceFromBedMeters": 1.8}
    vitals = {"heartRate": 132, "temperature": 37.6, "oxygenSaturation": 92}
    score, reasons, triggers, _motion = calculate_risk(tracking, vitals, 60)
    assert severity_from_score(score) == "CRITICAL", score
    assert "FALL_COMBINED" in triggers
    assert "HR_VERY_HIGH" in triggers


def test_rate_of_change_detects_hr_spike():
    # The capability the dashboard lacks: a sharp move that, in absolute terms,
    # is not yet at an alarming threshold, but the speed of change is.
    ref = {"heartRate": 80, "oxygenSaturation": 98, "temperature": 36.8, "fallProbability": 10}
    cur = {"heartRate": 110, "oxygenSaturation": 98, "temperature": 36.8, "fallProbability": 10}
    score, reasons, triggers = detect_changes(cur, ref, span_seconds=9)
    assert "HR_RAPID_CHANGE" in triggers, triggers
    assert score >= 20


def test_rate_of_change_detects_spo2_drop_and_fall_surge():
    ref = {"heartRate": 80, "oxygenSaturation": 98, "temperature": 36.8, "fallProbability": 10}
    cur = {"heartRate": 82, "oxygenSaturation": 93, "temperature": 36.9, "fallProbability": 90}
    score, reasons, triggers = detect_changes(cur, ref, span_seconds=6)
    assert "SPO2_RAPID_DROP" in triggers
    assert "FALLPROB_SURGE" in triggers


def test_state_needs_min_span_before_diffing():
    state = PatientState(window_seconds=30)
    state.add_sample(100.0, {"heartRate": 80})
    # Only ~1s later — too soon to trust a delta, must return None.
    assert state.reference(101.0) is None
    # 5s later — enough span.
    ref = state.reference(105.0)
    assert ref is not None and ref[1]["heartRate"] == 80


def test_immobility_resets_on_motion():
    state = PatientState(window_seconds=30)
    state.update_immobility(0.1, "lying", 100.0, 0)      # immobile
    state.add_sample(100.0, {})
    t1 = state.update_immobility(0.1, "lying", 103.0, 0)  # still immobile, +3s
    assert t1 >= 3
    t2 = state.update_immobility(5.0, "standing", 106.0, 0)  # moving again
    assert t2 == 0.0


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"PASS {t.__name__}")
    print(f"\nAll {len(tests)} rule tests passed.")
