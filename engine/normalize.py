"""Complete partial edge-node observations into the canonical patient schema.

Room-101's ESP32 ("sensor hub") is an environment + doorway node: it can only
physically measure room temperature, an analog gas level and a VL53L0X doorway
laser. The patient vitals the rule engine and the dashboard require (heart rate,
SpO2, posture, fall probability, ...) do not exist for this node. A raw payload
therefore both crashes the rule engine (float(None) on a missing heartRate) and
fails the dashboard's zod schema (heartRate and devices are required).

This module completes every patient so the pipeline runs on REAL device data:

  * REAL device signals win and are surfaced under an observation-level
    ``environment`` block plus a rising-edge doorway ``roomOccupancy`` counter;
  * MISSING vitals/tracking are filled with stable, in-range placeholders chosen
    so they never raise an alert on their own (operator decision: "always normal");
  * the node's hard-coded timestamp is replaced with the server's wall clock, so
    downstream freshness gates (app.MAX_ALERT_AGE_SECONDS) no longer treat every
    snapshot as stale.

Note: the node reports ``vitals.temperature`` as AMBIENT room temperature, not
body temperature. Feeding ~25 C into the body-temperature rule would read as
"hypothermia", so it is routed to ``environment`` and body temperature is
simulated instead.
"""

from __future__ import annotations

from datetime import datetime, timezone

# Stable, in-range placeholders for the vitals this node cannot measure. Chosen
# so the rule engine scores them LOW — simulation never fabricates an alert.
SIM_VITALS = {
    "heartRate": 76,
    "temperature": 36.6,      # body temperature; ambient temp goes to environment
    "oxygenSaturation": 98,
}
SIM_TRACKING = {
    "personDetected": True,
    "posture": "sitting",
    "motionLevel": 4.8,
    "fallProbability": 6,
    "timeImmobileSeconds": 0,
    "distanceFromBedMeters": 0.0,
    "confidence": 0.97,
}

# A real, measured physiological vital always wins over the placeholder. Body
# temperature is intentionally excluded — the node's "temperature" is ambient.
REAL_VITAL_KEYS = ("heartRate", "oxygenSaturation", "respiratoryRate")

# Rising-edge doorway counter, per room: {roomId: {"present": bool, "entries": int}}.
_door_state: dict[str, dict] = {}


def _server_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _coalesce(*values):
    for value in values:
        if value is not None:
            return value
    return None


def _room_occupancy(room_id: str, door_present: bool) -> int:
    """Count inward doorway crossings (rising edge of presence), like the
    reference counter in ai_studio_code.py. Never decremented — it is a running
    entry tally, not a live headcount."""
    state = _door_state.setdefault(room_id, {"present": False, "entries": 0})
    if door_present and not state["present"]:
        state["entries"] += 1
    state["present"] = door_present
    return state["entries"]


def _complete_patient(patient: dict, timestamp: str) -> dict:
    raw_vitals = patient.get("vitals", {})
    vitals = dict(SIM_VITALS)
    for key in REAL_VITAL_KEYS:
        if isinstance(raw_vitals.get(key), (int, float)):
            vitals[key] = raw_vitals[key]

    bed_zone = patient.get("bedZone", "")
    tracking = dict(SIM_TRACKING)
    tracking["zone"] = bed_zone or "Bed A"

    devices = patient.get("devices")
    if not devices:
        devices = [{
            "id": "esp32-s3-sensor-hub-01",
            "type": "edge_sensor",
            "battery": 100,
            "lastSeen": timestamp,
        }]

    patient_id = patient.get("patientId", "PATIENT-A")
    return {
        "patientId": patient_id,
        "displayAlias": patient.get("displayAlias", patient_id),
        "bedZone": bed_zone,
        "tracking": tracking,
        "vitals": vitals,
        "devices": devices,
        "robot": patient.get("robot", {"available": True}),
    }


def normalize_observation(observation: dict) -> dict:
    """Return a canonical-schema copy of ``observation``: every patient
    completed, real device signals preserved under ``environment``, a doorway
    occupancy counter attached, and the timestamp restamped to server time."""
    room_id = observation.get("roomId", "")
    patients = observation.get("patients", [])
    timestamp = _server_timestamp()

    # The node reports a single doorway; treat presence as room-wide.
    door_present = any(
        bool(p.get("tracking", {}).get("personDetected", False)) for p in patients
    )
    occupancy = _room_occupancy(room_id, door_present)

    # Real environment signals arrive on the (mis-named) first vitals/tracking block.
    first_vitals = patients[0].get("vitals", {}) if patients else {}
    first_tracking = patients[0].get("tracking", {}) if patients else {}
    environment = {
        "roomTemperatureC": first_vitals.get("temperature"),
        "gasLevel": first_vitals.get("gas_level"),
        "doorPresent": door_present,
        "distanceFromDoorMeters": _coalesce(
            first_tracking.get("distanceFromDoorMeters"),
            first_tracking.get("distanceFromBedMeters"),
        ),
        "roomOccupancy": occupancy,
    }

    return {
        "roomId": room_id,
        "timestamp": timestamp,
        "patients": [_complete_patient(p, timestamp) for p in patients],
        "environment": environment,
    }
