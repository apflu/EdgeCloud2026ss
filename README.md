# 🏥 Smart Medical Waiting Room - IoT System Architecture

## 📖 Projektübersicht
Dieses Repository enthält die Sensor-/Device-Infrastruktur für einen intelligenten medizinischen Warteraum. Das System verbindet **Energy Management** mit **Patient Safety**.

Für Datenschutz im medizinischen Umfeld nutzt das System primär anonyme Sensorik wie Raumklima, Distanz, Gas und später Radar. Kamera-Feeds sollen nur ereignisbasiert an einen lokalen Server geschickt werden. Die Kamera selbst ist nicht die finale KI-Analyse-Schicht.

## 📐 Systemarchitektur

Das Projekt folgt einer klaren Trennung der Verantwortlichkeiten:

```text
Sensor Hub / Camera Node
        ↓
MQTT Broker / lokaler Server
        ↓
Patient Observation JSON
        ↓
Dashboard / Operator UI
```

### Node 1: Sensor Hub (`sensor_hub_node/`)

- **Hardware:** ESP32-S3
- **Protokolle:** I2C, ADC, MQTT
- **Sensoren:** AHT/BMP280, VL53L0X, MQ-2
- **Funktion:** Aggregiert Raum-/Sensordaten und sendet JSON per MQTT.

### Node 2: Vision Node (`camera_node/`)

- **Hardware:** AI Thinker ESP32-CAM
- **Protokolle:** HTTP/TCP MJPEG Stream
- **Funktion:** Liefert einen lokalen Kamerastream an den Server. Die Auswertung wie Posture, Motion oder Fall Probability muss auf dem lokalen Server / KI-Backend passieren.

## 🧪 Pseudo Hardware Publisher

Für Tests ohne echte Hardware gibt es Python-Simulatoren unter:

```text
sensor_hub_node/simulators/
```

### Sensor-Hub-Simulation

Publiziert hardware-nahe Raumdaten auf MQTT:

```bash
cd sensor_hub_node/simulators
pip install -r requirements.txt
python pseudo_sensor_hub_publisher.py --broker localhost --port 1883
```

Topic:

```text
edge/sensors/waiting_room_1/hub
```

### Patient-Observation-Simulation

Publiziert dashboard-ready Beobachtungsdaten für drei Patienten:

```bash
python pseudo_patient_observation_publisher.py --broker localhost --port 1883 --mode mixed
```

Topic:

```text
edge/observations/room/101
```

Diese Simulation ersetzt nicht die Hardware. Sie hilft, die MQTT-zu-Dashboard-Kette zu testen, bevor die finale Vision-/Backend-Schicht fertig ist.

## 📂 Repository-Struktur

```text
Project/
 ┣ sensor_hub_node/       # PlatformIO ESP32-S3 Projekt
 ┃ ┣ lib/                 # Sensor-Klassen
 ┃ ┣ src/                 # MQTT JSON Publisher
 ┃ ┗ simulators/          # Python MQTT Test-Publisher
 ┣ camera_node/           # ESP32-CAM Streaming-Prototyp
 ┗ README.md
```
