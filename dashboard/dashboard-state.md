# Dashboard — Zustandsdiagramme

Drei Zustandsmaschinen der Dashboard-Schicht: Alarm-Lebenszyklus, Verbindungsmodus und Roboter-Antwortzyklus.

## Alarm-Lebenszyklus

```mermaid
stateDiagram-v2
    [*] --> OPEN : generateAlerts() (Severity >= MEDIUM)
    OPEN --> ACKNOWLEDGED : acknowledgeAlert()
    OPEN --> RESOLVED : resolveAlert()
    ACKNOWLEDGED --> RESOLVED : resolveAlert()
    OPEN --> OPEN : escalateAlert()<br/>MEDIUM → HIGH → CRITICAL
    ACKNOWLEDGED --> OPEN : recordNoPatientResponse()<br/>(Re-Eskalation)
    RESOLVED --> [*]
```

## Verbindungsmodus (ConnectionMode)

```mermaid
stateDiagram-v2
    [*] --> local_observation_simulation : Standard (kein VITE_WS_URL)
    local_observation_simulation --> server_websocket : VITE_WS_URL gesetzt + verbunden
    server_websocket --> server_websocket : Reconnect (2s Backoff)
    server_websocket --> local_observation_simulation : Verbindung dauerhaft weg
    local_observation_simulation --> paused : pause()
    server_websocket --> paused : pause()
    paused --> local_observation_simulation : resume()
    local_observation_simulation --> manual_json : submitObservationJson()
    manual_json --> local_observation_simulation : resume() / reset()
```

## Roboter-Antwortzyklus

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> AwaitingResponse : sendRobotCommand()<br/>awaitingPatientResponse=true
    AwaitingResponse --> Idle : recordPatientResponseOk()<br/>(nicht-kritische Alarme acknowledge)
    AwaitingResponse --> Escalated : recordNoPatientResponse()<br/>(Alarme → CRITICAL)
    Escalated --> Idle : resolveAlert()
```
