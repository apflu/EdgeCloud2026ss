# Secure MedTech UI - Observation Dashboard

React + TypeScript dashboard for the Secure MedTech Companion interface layer.

This version is focused on realistic frontend responsibilities:

- receives patient observations: vitals + edge/camera tracking metadata;
- derives risk, alerts, robot suggestions, device state and audit events internally;
- supports operator actions: acknowledge, resolve, escalate, patient checked;
- provides selectable robot actions with realistic hospital-oriented prompts;
- includes a manual JSON input panel at the bottom of the page for testing payloads.

## Run

```bash
npm install
npm run dev -- --host 0.0.0.0
```

## Test

```bash
npm run build
npm run test
```

## Main files

```text
src/types/incoming.ts              Patient observation JSON contract
src/lib/mockObservations.ts        Local generated observation samples
src/lib/riskEngine.ts              Internal risk calculation
src/lib/alertEngine.ts             Alert generation
src/lib/deviceEngine.ts            Device state derivation
src/lib/robot.ts                   Robot command options and payloads
src/lib/deriveDashboardState.ts    Observation -> dashboard state
src/components/ObservationInputPanel.tsx  Manual JSON test panel
src/hooks/useDashboardStream.ts    State controller and operator actions
```

## Local simulation

The changing demo data is generated in `src/lib/mockObservations.ts` as TypeScript generator functions, not as static `.json` files. The local stream randomly switches between normal, resting, active, elevated-risk, vitals-concern, bed-exit, device-issue, tracking-loss and fall-like observations.

## Expected input contract

The preferred server structure is:

```json
{
  "roomId": "Room-101",
  "timestamp": "2026-05-06T10:20:00Z",
  "patients": [
    {
      "patientId": "PATIENT-A",
      "displayAlias": "Patient A",
      "bedZone": "Bed A",
      "tracking": {
        "personDetected": true,
        "zone": "Floor Area",
        "posture": "lying",
        "motionLevel": 0.1,
        "fallProbability": 92,
        "timeImmobileSeconds": 42,
        "distanceFromBedMeters": 1.6,
        "confidence": 0.93
      },
      "vitals": {
        "heartRate": 122,
        "temperature": 37.8,
        "oxygenSaturation": 94
      },
      "devices": [
        {
          "id": "esp32-A",
          "type": "wearable",
          "battery": 68,
          "lastSeen": "2026-05-06T10:19:58Z"
        }
      ],
      "robot": {
        "available": true
      }
    }
  ]
}
```

The dashboard should not require risk score, alerts, robot commands or audit entries from the server.
