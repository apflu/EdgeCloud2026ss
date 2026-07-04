# System — Datenmodell (gemeinsamer JSON-Vertrag)

Die JSON-Schemata, die als Integrationsvertrag zwischen allen drei Projekten fließen. Es gibt keine gemeinsame Programmiersprache — die Struktur wird auf der Dashboard-Seite mit Zod validiert und auf der Main-Seite in `normalize.py` erzeugt.

```mermaid
classDiagram
  class RoomState {
    +string roomId
    +string timestamp
    +Patient[] patients
    +Environment environment
  }
  class Patient {
    +string patientId
    +string displayAlias
    +string bedZone
  }
  class Tracking {
    +bool personDetected
    +string zone
    +string posture
    +number motionLevel
    +number fallProbability
    +number timeImmobileSeconds
    +number distanceFromBedMeters
    +number confidence
  }
  class Vitals {
    +number heartRate
    +number temperature
    +number oxygenSaturation
    +number respiratoryRate
  }
  class Device {
    +string id
    +string type
    +number battery
    +string lastSeen
  }
  class Robot {
    +bool available
  }
  class Environment {
    +number roomTemperatureC
    +number gasLevel
    +bool doorPresent
    +number distanceFromDoorMeters
    +number roomOccupancy
  }
  class Alert {
    +string id
    +string patientId
    +string severity
    +number score
    +string title
    +string[] reasons
    +string[] triggers
    +string createdAt
    +string status
  }
  class EnrichedAlert {
    +string alertId
    +string patientId
    +string severity
    +string summary
    +string recommendedAction
    +string robotSpeech
    +string model
  }

  RoomState "1" *-- "1..*" Patient
  RoomState "1" *-- "0..1" Environment
  Patient "1" *-- "1" Tracking
  Patient "1" *-- "1" Vitals
  Patient "1" *-- "0..*" Device
  Patient "1" *-- "0..1" Robot
  Alert ..> Patient : referenziert patientId
  EnrichedAlert ..> Alert : referenziert alertId
```

## Herkunft der Felder (echt vs. simuliert)

| Feld | Herkunft |
|---|---|
| `tracking.distanceFromBedMeters` | **echt** — VL53L0X ToF (Sensor) |
| `vitals.temperature` | **echt** — AHT20/BMP280 (Umgebungstemperatur, Sensor) |
| `environment.gasLevel` / `gas_adc_level` | **echt** — MQ-2 ADC (Sensor) |
| `environment.roomOccupancy` | abgeleitet — Türzähler in `normalize.py` |
| `tracking.posture`, `fallProbability`, `personDetected` | **simuliert/geplant** — soll aus Vision-KI stammen |
| `vitals.heartRate`, `oxygenSaturation`, `respiratoryRate` | **simuliert** — Platzhalter (`SIM_VITALS`) |
| `Alert.severity`, `score`, `triggers` | abgeleitet in `engine` (Main) |
| `EnrichedAlert.*` | erzeugt vom LLM in `app` (Main) |

> Hinweis: `temperature` des Sensor-Knotens ist eigentlich **Umgebungstemperatur** und wird von `normalize.py` in den `environment`-Block umgeleitet; die Körpertemperatur wird simuliert.
