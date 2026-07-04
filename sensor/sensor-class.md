# Sensor — Klassendiagramm

Die ESP32-Firmware-Schicht. Der Sensor-Hub (`sensor_hub_node`) ist objektorientiert (drei Sensortreiber-Klassen); der Kamera-Knoten ist prozedural. Ankerdateien: `sensor_hub_node/lib/*`, `sensor_hub_node/src/main.cpp`, `camera_node/.../camera.ino`.

```mermaid
classDiagram
  direction LR

  class EnvironmentMonitor {
    -Adafruit_AHTX0 aht
    -Adafruit_BMP280 bmp
    -bool aht_ready
    -bool bmp_ready
    -float last_temp
    -float last_humidity
    -float last_pressure
    +bool begin()
    +void update()
    +float getTemperature()
    +float getHumidity()
    +float getPressure()
  }
  class PatientCounter {
    -Adafruit_VL53L0X lox
    -bool is_ready
    -int last_distance_mm
    -bool present
    -uint8_t enter_streak
    -uint8_t exit_streak
    -unsigned long count
    +bool begin()
    +void update()
    +int getDistance()
    +bool isPresent()
    +unsigned long getCount()
    +void resetCount()
  }
  class GasAlarm {
    -int adc_pin
    -int last_gas_value
    +bool begin(int pin)
    +void update()
    +int getGasLevel()
  }
  class main {
    <<module / firmware>>
    +setup()
    +loop()
    +setup_wifi()
    +reconnect_mqtt()
    +EnvironmentMonitor envMonitor
    +PatientCounter patientCounter
    +GasAlarm gasAlarm
    +WiFiClient espClient
    +PubSubClient mqttClient
  }
  class camera {
    <<module / firmware>>
    +stream_handler()
    +startCameraServer()
    +setup()
    +loop()
  }

  class Adafruit_AHTX0
  class Adafruit_BMP280
  class Adafruit_VL53L0X
  class PubSubClient

  main *-- EnvironmentMonitor
  main *-- PatientCounter
  main *-- GasAlarm
  main *-- PubSubClient
  EnvironmentMonitor ..> Adafruit_AHTX0
  EnvironmentMonitor ..> Adafruit_BMP280
  PatientCounter ..> Adafruit_VL53L0X

  note for main "RadarTracker ist ein leerer Stub (0 Byte)\nund wird NICHT modelliert — nur geplant."
```

## Kernaussagen

- **`EnvironmentMonitor.begin()`** ist fehler-isolierend: liefert `true`, wenn **mindestens einer** der beiden Sensoren (AHT20 / BMP280 @ 0x77) lebt. `update()` schreibt bei Fehler den Sentinel `-999.0`.
- **`PatientCounter`** entprellt das flackernde VL53L0X-Signal: nur `RangeStatus == 0` wird vertraut, sonst wird der Zustand gehalten; Hysterese-Totband + N-Bestätigungen verhindern Phantomzählungen (siehe Zustandsdiagramm).
- **`main`** hält die drei Sensorobjekte plus `WiFiClient`/`PubSubClient` und ist der Firmware-Orchestrator (publish-only, fire-and-forget).
- **Kamera-Knoten** ist prozedural, ohne Klassen — ein reiner MJPEG-Streamer.
