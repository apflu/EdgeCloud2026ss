# Node 1: Smart Medical Sensor Hub (ESP32-S3)

## Sinn & Zweck
Dieser Node dient als "Sinnesorgan" des Warteraums. Er erfasst kontinuierlich die physische Umgebung, um die Triage und das Energy Management zu unterstützen.

## Hardware & Protokolle
- **AHT20/BMP280**: Raumklima (I2C) -> Steuerung von Heizung/Lüftung.
- **VL53L0X Laser**: Patienten-Zählung (I2C) -> Überwachung der Auslastung.
- **MQ-2 Sensor**: Brand-/Rauchgas-Erkennung (Analog ADC).

## Schnittstelle (JSON)
Die Daten werden in einem standardisierten JSON-Format aggregiert und via MQTT versendet.
**Nächste Schritte für Backend/Cloud-Team:**
1. Abonnieren des MQTT-Topics `karlsruhe/medical/sensor_hub`.
2. Speichern der Werte in einer Time-Series Datenbank (InfluxDB).
3. Visualisierung in Grafana.