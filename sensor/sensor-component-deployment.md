# Sensor — Komponenten-/Verteilungsdiagramm

Zwei unabhängige Hardware-Knoten plus optionale Python-Simulatoren als Hardware-/Backend-Ersatz.

```mermaid
flowchart TB
  subgraph Hub["ESP32-S3 Sensor-Hub «device»"]
    direction TB
    fw["Firmware main.cpp<br/>PubSubClient (publish-only)"]
    aht["AHT20 (Temp/Feuchte)<br/>I2C SDA=4 / SCL=5"]
    bmp["BMP280 (Druck)<br/>I2C @ 0x77"]
    tof["VL53L0X (ToF-Distanz)<br/>I2C @ 0x29"]
    gas["MQ-2 (Gas)<br/>ADC GPIO6"]
    aht --> fw
    bmp --> fw
    tof --> fw
    gas --> fw
  end

  subgraph Cam["ESP32-CAM «device»"]
    camfw["camera.ino<br/>esp_http_server :81 /stream"]
  end

  subgraph Sim["Python-Simulatoren «optional»"]
    s1["pseudo_sensor_hub_publisher.py"]
    s2["pseudo_patient_observation_publisher.py"]
  end

  broker["MQTT-Broker (Mosquitto)<br/>«external, Main»"]
  vlm["Lokaler VLM-Server<br/>«external, EPYC/RTX»"]

  fw -- "MQTT/TCP:1883<br/>PUB edge/observations/room/101<br/>alle 3s, QoS wie konfiguriert" --> broker
  s1 -. "MQTT (Hardware-Ersatz)" .-> broker
  s2 -. "MQTT (Backend-Ersatz)" .-> broker
  camfw -- "HTTP:81 MJPEG /stream (Pull)" --> vlm
```

## Kernaussagen

- **Sensor-Hub → MQTT/TCP:1883**, Topic `edge/observations/room/101`, alle 3 s, fire-and-forget. Buffer auf 1024 B erhöht wegen der großen JSON-Payload.
- **Kamera → HTTP:81 MJPEG (Pull)** — das Gerät ist ein "dummer Streamer"; der lokale VLM-Server zieht den Stream und führt die Vision-KI aus.
- **Python-Simulatoren** stehen wahlweise für die Hardware (`pseudo_sensor_hub_publisher`) oder die Backend-/KI-Schicht (`pseudo_patient_observation_publisher`) ein.
- **Konfiguration** (`main.cpp:18-28`): `ssid`, `password`, `mqtt_server`, `mqtt_port`, `mqtt_topic` sowie die Pin-Defines.

> Inkonsistenz: Die README-Dateien nennen abweichende Topics (`karlsruhe/medical/sensor_hub`, `edge/sensors/waiting_room_1/hub`). Maßgeblich ist der Code: `edge/observations/room/101`.
