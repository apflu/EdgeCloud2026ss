"""
Pseudo Patient Observation Publisher
------------------------------------
Simulates the output that a local backend/AI layer would produce AFTER processing
sensor hub data + camera/vision metadata.

This is NOT ESP32 raw hardware data. It is the dashboard-ready observation JSON.
Use it to test the MQTT -> dashboard flow before the real AI/vision backend exists.
"""

from __future__ import annotations

import argparse
import json
import random
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

DEFAULT_TOPIC = "edge/observations/room/101"
PATIENTS = [
    ("PATIENT-A", "Patient A", "Bed A"),
    ("PATIENT-B", "Patient B", "Bed B"),
    ("PATIENT-C", "Patient C", "Bed C"),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def device(patient_id: str, ts: str, battery: int | None = None) -> dict:
    suffix = patient_id.split("-")[-1]
    return {
        "id": f"esp32-{suffix}",
        "type": "wearable",
        "battery": battery if battery is not None else random.randint(55, 95),
        "lastSeen": ts,
    }


def normal_patient(patient_id: str, alias: str, bed: str) -> dict:
    ts = now_iso()
    return {
        "patientId": patient_id,
        "displayAlias": alias,
        "bedZone": bed,
        "tracking": {
            "personDetected": True,
            "zone": bed,
            "posture": random.choice(["sitting", "standing", "lying"]),
            "motionLevel": round(random.uniform(2.5, 7.5), 2),
            "fallProbability": random.randint(2, 22),
            "timeImmobileSeconds": 0,
            "distanceFromBedMeters": round(random.uniform(0.0, 0.45), 2),
            "confidence": round(random.uniform(0.86, 0.98), 2),
        },
        "vitals": {
            "heartRate": random.randint(68, 95),
            "temperature": round(random.uniform(36.2, 37.2), 1),
            "oxygenSaturation": random.randint(96, 99),
        },
        "devices": [device(patient_id, ts)],
    }


def elevated_patient(patient_id: str, alias: str, bed: str) -> dict:
    patient = normal_patient(patient_id, alias, bed)
    patient["tracking"].update({
        "zone": "Near Bed",
        "posture": random.choice(["sitting", "lying"]),
        "motionLevel": round(random.uniform(0.4, 1.2), 2),
        "fallProbability": random.randint(45, 70),
        "timeImmobileSeconds": random.randint(12, 24),
        "distanceFromBedMeters": round(random.uniform(0.4, 0.9), 2),
    })
    patient["vitals"].update({
        "heartRate": random.randint(96, 116),
        "oxygenSaturation": random.randint(94, 97),
    })
    return patient


def emergency_patient(patient_id: str, alias: str, bed: str) -> dict:
    ts = now_iso()
    return {
        "patientId": patient_id,
        "displayAlias": alias,
        "bedZone": bed,
        "tracking": {
            "personDetected": True,
            "zone": "Floor Area",
            "posture": "lying",
            "motionLevel": round(random.uniform(0.0, 0.2), 2),
            "fallProbability": random.randint(88, 97),
            "timeImmobileSeconds": random.randint(30, 70),
            "distanceFromBedMeters": round(random.uniform(1.1, 2.1), 2),
            "confidence": round(random.uniform(0.86, 0.97), 2),
        },
        "vitals": {
            "heartRate": random.randint(115, 140),
            "temperature": round(random.uniform(37.0, 38.1), 1),
            "oxygenSaturation": random.randint(91, 95),
        },
        "devices": [device(patient_id, ts, battery=random.randint(45, 85))],
    }


def tracking_loss_patient(patient_id: str, alias: str, bed: str) -> dict:
    patient = normal_patient(patient_id, alias, bed)
    patient["tracking"].update({
        "personDetected": False,
        "zone": "Unknown",
        "posture": "unknown",
        "motionLevel": 0.0,
        "fallProbability": random.randint(35, 65),
        "timeImmobileSeconds": random.randint(0, 18),
        "distanceFromBedMeters": 0.0,
        "confidence": round(random.uniform(0.12, 0.35), 2),
    })
    return patient


def fixed_alert_patient(patient_id: str, alias: str, bed: str) -> dict:
    """Patient C: a constant, alert-triggering state that does NOT change between
    cycles. Only the timestamps refresh; every alert-driving field is fixed, so
    the dashboard always shows one persistent alert to observe while A and B
    flicker between normal and alert states. The values describe a likely fall:
    on the floor, immobile, high fall probability, high heart rate, low SpO2 ->
    derives to CRITICAL. Constant values also mean no rate-of-change triggers
    after the first cycle, so the alert stays steady rather than spiking."""
    ts = now_iso()
    return {
        "patientId": patient_id,
        "displayAlias": alias,
        "bedZone": bed,
        "tracking": {
            "personDetected": True,
            "zone": "Floor Area",
            "posture": "lying",
            "motionLevel": 0.0,
            "fallProbability": 95,
            "timeImmobileSeconds": 60,
            "distanceFromBedMeters": 1.8,
            "confidence": 0.93,
        },
        "vitals": {
            "heartRate": 132,
            "temperature": 37.6,
            "oxygenSaturation": 92,
        },
        "devices": [device(patient_id, ts, battery=70)],
    }


def event_patient(mode: str, patient_tuple: tuple) -> dict:
    """The alert state used for the rotating patient (A or B), chosen by mode."""
    if mode == "emergency":
        return emergency_patient(*patient_tuple)
    if mode == "tracking-loss":
        return tracking_loss_patient(*patient_tuple)
    if mode == "elevated":
        return elevated_patient(*patient_tuple)
    if mode == "mixed":
        return random.choice([elevated_patient, emergency_patient, tracking_loss_patient])(*patient_tuple)
    return normal_patient(*patient_tuple)


def build_room_observation(mode: str) -> dict:
    ts = now_iso()
    patients = []

    # Patient C (index 2) is pinned to a constant alert-triggering state, so there
    # is always one persistent alert. Patients A and B keep rotating: one is
    # randomly chosen each cycle to show an alert state (per mode), the other
    # stays normal. In "normal" mode A and B are both normal (C still alerts).
    rotating_event = random.choice([0, 1])

    for index, patient_tuple in enumerate(PATIENTS):
        if index == 2:
            patients.append(fixed_alert_patient(*patient_tuple))
        elif index == rotating_event and mode != "normal":
            patients.append(event_patient(mode, patient_tuple))
        else:
            patients.append(normal_patient(*patient_tuple))

    return {"roomId": "Room-101", "timestamp": ts, "patients": patients}


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish pseudo patient observation JSON to MQTT.")
    parser.add_argument("--broker", default="localhost", help="MQTT broker host/IP. Default: localhost")
    parser.add_argument("--port", type=int, default=1883, help="MQTT broker port. Default: 1883")
    parser.add_argument("--topic", default=DEFAULT_TOPIC, help=f"MQTT topic. Default: {DEFAULT_TOPIC}")
    parser.add_argument("--interval", type=float, default=3.0, help="Publish interval in seconds. Default: 3")
    parser.add_argument(
        "--mode",
        default="mixed",
        choices=["normal", "elevated", "emergency", "tracking-loss", "mixed"],
        help="Scenario mode. Default: mixed",
    )
    args = parser.parse_args()

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.connect(args.broker, args.port, 60)
    client.loop_start()

    print(f"Publishing pseudo patient observations to mqtt://{args.broker}:{args.port}/{args.topic}")
    try:
        while True:
            payload = build_room_observation(args.mode)
            raw = json.dumps(payload, separators=(",", ":"))
            result = client.publish(args.topic, raw, qos=1)
            result.wait_for_publish()
            print(json.dumps(payload, indent=2))
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nStopped pseudo patient observation publisher.")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
