# Sensor — Sequenzdiagramme

## Szenario A — setup() (Boot)

```mermaid
sequenceDiagram
    autonumber
    participant MCU as ESP32-S3 (main)
    participant WiFi as WiFi (STA)
    participant Broker as MQTT-Broker
    participant Env as EnvironmentMonitor
    participant PC as PatientCounter
    participant Gas as GasAlarm

    MCU->>WiFi: setup_wifi() (20 × 500 ms Retry)
    WiFi-->>MCU: verbunden
    MCU->>Broker: reconnect_mqtt() (Client-ID ESP32-MedicalHub-<hex>)
    Broker-->>MCU: connected (Buffer 1024 B)
    MCU->>Env: begin() (AHT20 + BMP280 @ 0x77)
    MCU->>PC: begin() (VL53L0X @ 0x29)
    MCU->>Gas: begin(GAS_PIN=6)
```

## Szenario B — loop() (3-Sekunden-Takt)

```mermaid
sequenceDiagram
    autonumber
    participant MCU as ESP32-S3 (main)
    participant Env as EnvironmentMonitor
    participant PC as PatientCounter
    participant Gas as GasAlarm
    participant JSON as ArduinoJson
    participant Broker as MQTT-Broker

    loop alle 3000 ms (millis-Timer)
        MCU->>MCU: WiFi/MQTT-Reconnect-Guards + mqttClient.loop()
        MCU->>Env: update() → getTemperature()
        MCU->>PC: update() → getDistance() / isPresent()
        MCU->>Gas: update() → getGasLevel()
        MCU->>JSON: Observation-JSON bauen (Room → Patient → tracking/vitals/devices)
        JSON-->>MCU: serialisiert
        MCU->>Broker: mqttClient.publish("edge/observations/room/101", payload)
    end
```

## Szenario C — Kamera-Stream (Pull-Modell)

```mermaid
sequenceDiagram
    autonumber
    participant VLM as Lokaler VLM-Server
    participant Cam as ESP32-CAM (HTTP :81)
    participant Sensor as Kamerasensor

    VLM->>Cam: GET /stream
    activate Cam
    loop Frames
        Cam->>Sensor: esp_camera_fb_get()
        Sensor-->>Cam: JPEG-Frame
        Cam-->>VLM: multipart/x-mixed-replace (MJPEG)
    end
    deactivate Cam
```

> Hinweis: Der Hub kennt keinen MQTT-Subscribe/Callback — er publiziert ausschließlich. Der Zeitstempel im JSON ist aus `millis()` gefälscht (kein RTC).
