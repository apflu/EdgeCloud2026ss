# Main — Zustandsdiagramme

## Severity-Schwellen (rules.severity_from_score)

Die Risikobewertung mappt einen Score (0–100) auf eine von vier Stufen. Alarme werden erst ab `MEDIUM` publiziert.

```mermaid
stateDiagram-v2
    [*] --> LOW
    LOW --> MEDIUM : score >= 45
    MEDIUM --> HIGH : score >= 75
    HIGH --> CRITICAL : score >= 90
    CRITICAL --> HIGH : score < 90
    HIGH --> MEDIUM : score < 75
    MEDIUM --> LOW : score < 45

    note right of LOW
        Kein Alarm publiziert (evaluate_patient → None)
    end note
    note right of MEDIUM
        Ab hier: PUB edge/alerts/room/101
    end note
```

## Alarm-Dedup / -Lebenszyklus je Patient (PatientState.alert_lifecycle)

```mermaid
stateDiagram-v2
    [*] --> KeinAlarm : last_alert = None
    KeinAlarm --> AlarmAktiv : neuer alert_id<br/>createdAt = timestamp
    AlarmAktiv --> AlarmAktiv : gleicher alert_id<br/>createdAt bleibt erhalten (Dedup)
    AlarmAktiv --> AlarmAktiv : anderer alert_id<br/>createdAt = neuer timestamp
    AlarmAktiv --> KeinAlarm : clear_alert()<br/>(Severity fällt auf LOW)
    KeinAlarm --> [*]
```

## Rollierendes Sample-Fenster (PatientState.add_sample)

```mermaid
stateDiagram-v2
    [*] --> Sammeln
    Sammeln --> Sammeln : add_sample(epoch, metrics)<br/>append + alte Samples < (epoch - window) verwerfen
    Sammeln --> BereitFuerDelta : span >= MIN_CHANGE_SPAN (2.0s)
    BereitFuerDelta --> Sammeln : detect_changes() gegen reference()
```

> `window` = `CHANGE_WINDOW_SECONDS` (Konfig). Ein Delta wird erst vertraut, wenn mindestens `MIN_CHANGE_SPAN` (2,0 s) seit dem Referenz-Sample vergangen ist.
