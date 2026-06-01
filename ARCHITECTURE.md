# Secure MedTech Dashboard Architecture

This project is the **Visual / Robot / Operator Interface** layer of the Secure MedTech Companion.

It does not process raw video and it does not perform low-level camera tracking. The camera/edge/server layer is responsible for calculating privacy-preserving tracking metadata such as posture, zone, motion level, fall probability, immobility time, distance from bed, and tracking confidence.

The dashboard receives a **Patient Observation JSON** containing:

- vital measurements from patient sensors;
- edge-derived tracking metadata from the camera/edge system;
- basic device metadata such as battery and last-seen time;
- robot availability.

The dashboard then internally derives:

- risk score;
- alert severity;
- alert reasons;
- device state;
- robot command suggestions;
- audit events;
- operator workflow state;
- trend histories.

## Correct responsibility split

```text
Hardware / camera / edge / server
  -> sensor readings
  -> tracking metadata
  -> patient observation JSON

Dashboard
  -> validate JSON
  -> calculate risk
  -> generate alerts
  -> suggest robot action
  -> support operator actions
  -> log audit events
```

## Why this split matters

The server should send facts and observations, not UI decisions. The dashboard should not receive final risk scores, final alerts, or final robot commands. This keeps the communication contract clean and prevents the backend from being polluted by visualization-specific logic.

## Manual JSON input

The dashboard includes a manual JSON input panel. This is for testing realistic server payloads before the final connection is ready. Pasting a valid observation JSON pauses the local simulation and lets the dashboard derive all warning and robot behavior internally.

The JSON input must not include raw video, images, full identity data, final risk score, final alerts, or robot decisions.

## Robot logic

Robot commands are predefined and deterministic. The system avoids free-form medical claims. Commands are derived from current risk severity and tracking uncertainty. The panel can generate an outgoing command payload preview for later integration with the partner server or MQTT bridge.
