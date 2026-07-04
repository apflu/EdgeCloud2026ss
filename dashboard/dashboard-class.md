# Dashboard — Klassendiagramm

Datenmodelle (Zod-Schemata bzw. TypeScript-Typen) und die Berechnungs-Engines der Dashboard-Schicht. Funktionsmodule ohne Klassencharakter sind als `«module»` dargestellt. Ankerdateien: `src/types/*.ts`, `src/lib/*.ts`, `src/hooks/useDashboardStream.ts`.

```mermaid
classDiagram
  direction LR

  class IncomingRoomState {
    +string roomId
    +string timestamp
    +IncomingPatient[] patients
    +Environment environment
  }
  class IncomingPatient {
    +string patientId
    +string displayAlias
    +string bedZone
    +tracking
    +vitals
    +devices
    +robot
  }
  class RiskResult {
    +number score
    +Severity severity
    +string[] reasons
    +motionState motionState
  }
  class DashboardData {
    +string roomId
    +privacyMode privacyMode
    +string lastUpdated
    +patient
    +RoomPatientSummary[] roomPatients
    +health
    +tracking
    +Environment environment
    +AlertItem[] alerts
    +DeviceItem[] devices
    +privacy
    +robot
    +AuditItem[] audit
  }
  class AlertItem {
    +string id
    +Severity severity
    +string title
    +string[] reason
    +string createdAt
    +status status
  }
  class DeviceItem {
    +string id
    +string type
    +DeviceStatus status
    +number battery
    +string lastSeen
    +number[] batteryHistory
  }
  class RobotCommand {
    +RobotCommandCode code
    +string label
    +string speech
    +priority priority
    +intent intent
    +expectedResponse expectedResponse
    +bool staffNotification
    +string safetyNote
  }
  class BackendAlert {
    +string id
    +string severity
    +number score
    +string[] triggers
  }
  class EnrichedAlert {
    +string alertId
    +string summary
    +string recommendedAction
    +string robotSpeech
  }

  class riskEngine {
    <<module>>
    +calculateRisk(IncomingPatient) RiskResult
    +deriveMotionState(number) motionState
  }
  class alertEngine {
    <<module>>
    +generateAlerts(patient, RiskResult, ts, prev) AlertItem[]
  }
  class deviceEngine {
    <<module>>
    +deriveDevices(patient, prev) DeviceItem[]
    +deriveDeviceStatus(lastSeen, battery) DeviceStatus
  }
  class deriveDashboardState {
    <<module>>
    +deriveDashboardState(input, prev, selectedId, opts) DashboardData
  }
  class robot {
    <<module>>
    +buildRobotOptions(DashboardData) RobotCommand[]
    +buildRobotCommand(data, code) RobotCommand
    +buildRobotCommandPayload(data, command)
  }
  class risk {
    <<module>>
    +deriveOverallSeverity(DashboardData) Severity
  }
  class privacy {
    <<module>>
    +isPrivacyHealthy(data) bool
    +canShowRawVideo(data, role) bool
  }
  class useDashboardStream {
    <<hook>>
    +DashboardData data
    +ingestObservation()
    +acknowledgeAlert() / resolveAlert() / escalateAlert()
    +sendRobotCommand() / recordPatientResponseOk()
  }

  IncomingRoomState "1" *-- "1..*" IncomingPatient
  DashboardData "1" *-- "0..*" AlertItem
  DashboardData "1" *-- "0..*" DeviceItem
  DashboardData "1" *-- "0..*" RobotCommand : suggestedActions

  riskEngine ..> RiskResult : erzeugt
  riskEngine ..> IncomingPatient : liest
  alertEngine ..> riskEngine : nutzt RiskResult
  alertEngine ..> AlertItem : erzeugt
  deviceEngine ..> DeviceItem : erzeugt
  deriveDashboardState ..> riskEngine
  deriveDashboardState ..> alertEngine
  deriveDashboardState ..> deviceEngine
  deriveDashboardState ..> DashboardData : erzeugt
  robot ..> risk : nutzt deriveOverallSeverity
  robot ..> RobotCommand : erzeugt
  useDashboardStream ..> deriveDashboardState
  useDashboardStream ..> robot
  useDashboardStream ..> BackendAlert : reconciliation
  useDashboardStream ..> EnrichedAlert : reconciliation
```

## Kernaussagen

- **`deriveDashboardState` ist der Knotenpunkt** des Abhängigkeitsgraphen: Jede Datenquelle (Mock, WebSocket, manuelles JSON) läuft durch diese eine Funktion, die die drei Engines aufruft und ein validiertes `DashboardData` erzeugt.
- **Scoring (`calculateRisk`)** ist additiv gewichtet: `fallProbability × 0,4` plus Zuschläge für verlorenes Tracking, niedrige Konfidenz, Haltung, Bewegung, Immobilität, Vitalwert-Bänder; auf 0–100 begrenzt. Schwellen: `>=90 CRITICAL`, `>=75 HIGH`, `>=45 MEDIUM`, sonst `LOW`.
- **`BackendAlert`/`EnrichedAlert`** sind die autoritative Abgleichsschicht aus Main — das Dashboard versöhnt seine eigene Sofort-Einschätzung mit den Engine-Alarmen.
