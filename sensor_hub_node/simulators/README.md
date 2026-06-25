# Pseudo Hardware / Observation Publishers

This folder contains Python publishers for testing the MQTT flow without flashing hardware every time.

## 1. `pseudo_sensor_hub_publisher.py`

Simulates the ESP32-S3 Sensor Hub. It publishes hardware-level room sensor values:

- temperature
- humidity
- pressure
- door distance
- gas ADC level
- battery/status

Default topic:

```text
edge/sensors/waiting_room_1/hub
```

Run:

```bash
pip install -r requirements.txt
python pseudo_sensor_hub_publisher.py --broker localhost --port 1883
```

Use this to test the sensor-hub-to-MQTT part.

## 2. `pseudo_patient_observation_publisher.py`

Simulates the output that the local backend/AI layer would produce after processing sensor data and camera/vision metadata.

It publishes dashboard-ready patient observation JSON for three patients.

Default topic:

```text
edge/observations/room/101
```

Run:

```bash
pip install -r requirements.txt
python pseudo_patient_observation_publisher.py --broker localhost --port 1883 --mode mixed
```

Modes:

```text
normal
elevated
emergency
tracking-loss
mixed
```

Important: this script is not pretending to be the ESP32 raw hardware. It simulates the backend/AI observation output so the dashboard can be tested before the final vision pipeline exists.
