# Dashboard — Sequenzdiagramm

Zwei zentrale Abläufe der Dashboard-Schicht.

## Szenario A — Beobachtung eintreffen und rendern

```mermaid
sequenceDiagram
    autonumber
    participant Src as Datenquelle<br/>(WS / 3s-Timer / manuelles JSON)
    participant Hook as useDashboardStream
    participant Derive as deriveDashboardState
    participant Risk as riskEngine
    participant Alert as alertEngine
    participant Dev as deviceEngine
    participant Zod as DashboardSchema
    participant UI as React-Panels

    Src->>Hook: {type:"observation", data} / randomObservation()
    Hook->>Hook: parseIncomingRoomState(raw)
    Hook->>Derive: ingestObservation → deriveDashboardState(input, prev, selectedId)
    loop je Patient
        Derive->>Risk: calculateRisk(patient)
        Risk-->>Derive: RiskResult
    end
    Derive->>Alert: generateAlerts(patient, risk, ts, prev)
    Alert-->>Derive: AlertItem[]
    Derive->>Dev: deriveDevices(patient, prev)
    Dev-->>Derive: DeviceItem[]
    Derive->>Zod: DashboardSchema.parse(next)
    Zod-->>Derive: DashboardData (validiert)
    Derive-->>Hook: DashboardData
    Hook->>UI: setData() → Re-Render
```

## Szenario B — Roboterbefehl und Patientenantwort

```mermaid
sequenceDiagram
    autonumber
    participant Op as Operator
    participant Hook as useDashboardStream
    participant Robot as robot (lib)
    participant State as DashboardData

    Op->>Hook: sendRobotCommand(code?)
    Hook->>Robot: buildRobotCommand(data, code)
    Robot-->>Hook: RobotCommand
    Hook->>Robot: buildRobotCommandPayload(data, command)
    Robot-->>Hook: Payload-Vorschau (MQTT/Server)
    Hook->>State: robot.lastCommand, awaitingPatientResponse=true
    Hook->>State: audit-Eintrag anhängen

    alt Patient antwortet
        Op->>Hook: recordPatientResponseOk()
        Hook->>State: offene nicht-kritische Alarme acknowledge
    else keine Antwort
        Op->>Hook: recordNoPatientResponse()
        Hook->>State: offene Alarme → CRITICAL eskalieren
    end
```

> Hinweis: Bediener- und Roboteraktionen mutieren `DashboardData` direkt (nicht über `deriveDashboardState`) und hängen jeweils einen Eintrag an das gedeckelte `audit`-Log (~15 Einträge) an.
