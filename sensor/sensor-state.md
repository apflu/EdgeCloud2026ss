# Sensor — Zustandsdiagramme

## PatientCounter — Entprellte Anwesenheits-Zustandsmaschine

Das rohe VL53L0X-Signal flackert an der Erkennungsschwelle. Der Zähler entprellt mit Hysterese-Totband und N aufeinanderfolgenden Bestätigungen; eine fehlgeschlagene Messung (`RangeStatus != 0`) **hält** den Zustand. Konstanten aus `PatientCounter.cpp:6-12`.

```mermaid
stateDiagram-v2
    [*] --> Absent : begin()

    Absent --> Absent : Distanz > 1500 mm<br/>enter_streak = 0
    Absent --> Absent : gültige Messung < 1500 mm<br/>enter_streak++ (< 3)
    Absent --> Present : enter_streak erreicht 3<br/>(ENTER_SAMPLES) → count++

    Present --> Present : Distanz < 1800 mm<br/>exit_streak = 0
    Present --> Present : gültige Messung > 1800 mm<br/>exit_streak++ (< 5)
    Present --> Absent : exit_streak erreicht 5<br/>(EXIT_SAMPLES)

    note right of Present
        Totband 1500–1800 mm verhindert Prellen.
        RangeStatus != 0 → Zustand wird gehalten
        (weder enter_streak noch exit_streak).
    end note
```

## WiFi-/MQTT-Verbindungszustand (main loop)

```mermaid
stateDiagram-v2
    [*] --> WiFiConnecting : setup_wifi()
    WiFiConnecting --> WiFiConnected : verbunden
    WiFiConnecting --> WiFiConnecting : Retry (20 × 500 ms)
    WiFiConnected --> WiFiConnecting : Verbindung verloren (5 s Retry)
    WiFiConnected --> MqttConnecting : reconnect_mqtt()
    MqttConnecting --> MqttConnected : verbunden
    MqttConnecting --> MqttConnecting : Backoff 5 s
    MqttConnected --> Publishing : alle 3000 ms
    Publishing --> MqttConnected : publish() ok
    MqttConnected --> MqttConnecting : Verbindung verloren
```
