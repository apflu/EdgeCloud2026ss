# 🏥 Smart Medical Waiting Room - IoT System Architecture

## 📖 Projektübersicht
Dieses Repository enthält die Edge-Computing-Infrastruktur für einen intelligenten, medizinischen Warteraum. Das System vereint **Energy Management** (bedarfsgerechte Lüftungs- und Heizungssteuerung) mit **Patient Safety** (Sturzerkennung, Triage). 

Um Datenschutzvorgaben im medizinischen Umfeld zu erfüllen, nutzt das System primär anonyme Sensorik (Radar, ToF-Laser, Klima). Kamera-Feeds werden nur ereignisbasiert (Trigger) für ein lokales Vision-Language-Model (VLM) freigeschaltet.

## 📐 Systemarchitektur (Dumb Edge, Smart Cloud)
Das Projekt folgt einer strikten *Separation of Concerns* in einem Monorepo-Ansatz:

*   **Node 1: Sensor Hub (`sensor_hub_node/`)**
    *   **Hardware:** ESP32-S3
    *   **Protokolle:** I2C (Raumklima, Laser-Distanz), ADC (Gassensor), UART (Radar - in Entwicklung).
    *   **Funktion:** Aggregiert Rohdaten und liefert sie fehlerresistent über eine standardisierte JSON-Schnittstelle via MQTT an das Backend.
*   **Node 2: Vision & Triage (`camera_node/`)**
    *   **Hardware:** AI Thinker ESP32-CAM
    *   **Protokolle:** HTTP/TCP M-JPEG Stream
    *   **Funktion:** Streamt ereignisbasiert rohe Bilddaten (bis zu 15 MB/s) an den lokalen AMD EPYC Server zur Auswertung durch KI-Modelle.

## 📂 Repository-Struktur
```text
📦 Project/
 ┣ 📂 sensor_hub_node/    # C++ PlatformIO Projekt (Klima, Laser, Gas, Radar)
 ┃ ┣ 📂 lib/              # Objektorientierte Treiber-Klassen (Doxygen dokumentiert)
 ┃ ┣ 📂 src/              # JSON-Aggregator und MQTT-Client
 ┃ ┗ 📜 README.md         # Spezifische Node-Dokumentation
 ┣ 📂 camera_node/        # Arduino IDE Projekt (Vision)
 ┃ ┣ 📜 camera_node.ino   # HTTP M-JPEG Streaming Server
 ┃ ┗ 📜 README.md         # Spezifische Node-Dokumentation
 ┗ 📜 README.md           # Diese Datei (Architektur-Übersicht)

