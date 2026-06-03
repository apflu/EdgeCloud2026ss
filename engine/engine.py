"""
Rule / State Engine
-------------------
Authoritative, deterministic alerting for the Secure MedTech Companion.

Subscribes to patient observations and, for EVERY patient (not just the one an
operator happens to be looking at), derives an alert from two rule families:

  * absolute thresholds  (rules.calculate_risk — parity with the dashboard)
  * rate-of-change       (rules.detect_changes — drastic parameter moves)

The resulting alert snapshot is published, retained, to ALERTS_TOPIC so that:
  * alerts exist even when no browser dashboard is open;
  * every connected client sees the same authoritative decisions;
  * downstream actuators (robot, notifications) and a later LLM enrichment
    stage can subscribe to a single source of truth.

No LLM is involved in the trigger decision — by design. The LLM's role (later)
is only to narrate alerts that this engine has already fired.

Data path:
    edge/observations/room/101  --(facts)-->  [this engine]  --(alerts)-->  edge/alerts/room/101
"""

from __future__ import annotations

import json
import time
from datetime import datetime

import paho.mqtt.client as mqtt

from config import (
    ALERTS_TOPIC,
    CHANGE_WINDOW_SECONDS,
    MQTT_BROKER,
    MQTT_PORT,
    OBSERVATION_TOPIC,
)
from logger import log
from rules import alert_title, calculate_risk, detect_changes, severity_from_score
from state import RoomState

room = RoomState(CHANGE_WINDOW_SECONDS)


def _epoch(timestamp: str) -> float:
    """ISO-8601 -> epoch seconds. Tolerates a trailing 'Z'."""
    try:
        return datetime.fromisoformat(timestamp.replace("Z", "+00:00")).timestamp()
    except (ValueError, AttributeError):
        # Fall back to wall clock so a malformed timestamp can't stall the engine.
        return time.time()


def evaluate_patient(patient: dict, timestamp: str, epoch: float) -> dict | None:
    """Run both rule families for one patient. Returns an alert dict or None."""
    patient_id = patient["patientId"]
    tracking = patient.get("tracking", {})
    vitals = patient.get("vitals", {})
    state = room.get(patient_id)

    time_immobile = state.update_immobility(
        float(tracking.get("motionLevel", 0)),
        tracking.get("posture", "unknown"),
        epoch,
        tracking.get("timeImmobileSeconds"),
    )

    score, reasons, triggers, _motion = calculate_risk(tracking, vitals, time_immobile)

    metrics = {
        "heartRate": vitals.get("heartRate"),
        "oxygenSaturation": vitals.get("oxygenSaturation"),
        "temperature": vitals.get("temperature"),
        "fallProbability": tracking.get("fallProbability"),
    }
    reference = state.reference(epoch)
    if reference is not None:
        span, ref_metrics = reference
        change_score, change_reasons, change_triggers = detect_changes(metrics, ref_metrics, span)
        score = min(100, score + change_score)
        reasons += change_reasons
        triggers += change_triggers
    state.add_sample(epoch, metrics)

    severity = severity_from_score(score)
    if severity == "LOW":
        state.clear_alert()
        return None

    alert_id = f"ALERT-{patient_id}-{severity}"
    created_at = state.alert_lifecycle(alert_id, timestamp)

    return {
        "id": alert_id,
        "patientId": patient_id,
        "displayAlias": patient.get("displayAlias", patient_id),
        "bedZone": patient.get("bedZone", ""),
        "severity": severity,
        "score": score,
        "title": alert_title(severity),
        "reasons": reasons,
        "triggers": triggers,
        "createdAt": created_at,
        "status": "OPEN",
    }


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        log.info("Connected to MQTT broker {}:{}", MQTT_BROKER, MQTT_PORT)
        client.subscribe(OBSERVATION_TOPIC, qos=1)
        log.info("Subscribed to {}", OBSERVATION_TOPIC)
    else:
        log.error("MQTT connection failed: {}", reason_code)


def on_message(client, userdata, msg):
    try:
        observation = json.loads(msg.payload.decode())
    except (json.JSONDecodeError, UnicodeDecodeError):
        log.warning("Invalid observation payload on {}", msg.topic)
        return

    room_id = observation.get("roomId", "")
    timestamp = observation.get("timestamp", "")
    epoch = _epoch(timestamp)
    patients = observation.get("patients", [])

    alerts = []
    for patient in patients:
        try:
            alert = evaluate_patient(patient, timestamp, epoch)
        except (KeyError, TypeError, ValueError) as error:
            log.warning("Skipping patient {}: {}", patient.get("patientId", "?"), error)
            continue
        if alert is not None:
            alerts.append(alert)

    snapshot = {"roomId": room_id, "timestamp": timestamp, "alerts": alerts}
    # Retained so a freshly-connected consumer immediately learns current state.
    client.publish(ALERTS_TOPIC, json.dumps(snapshot, separators=(",", ":")), qos=1, retain=True)

    if alerts:
        summary = ", ".join(f"{a['patientId']}={a['severity']}({a['score']})" for a in alerts)
        log.info("Published {} alert(s): {}", len(alerts), summary)
    else:
        log.debug("All clear for {} patient(s)", len(patients))


def main():
    log.info("Rule/State engine starting up")
    mqttc = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    mqttc.on_connect = on_connect
    mqttc.on_message = on_message

    while True:
        try:
            mqttc.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            break
        except (ConnectionRefusedError, OSError):
            log.info("Waiting for MQTT broker...")
            time.sleep(2)

    mqttc.loop_forever()


if __name__ == "__main__":
    main()
