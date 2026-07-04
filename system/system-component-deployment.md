# System — Komponenten-/Verteilungsdiagramm

Überblick über alle drei Projekte: physische Knoten, Container und die Kommunikationswege (MQTT-Topics, WebSocket, HTTP). Die Beschriftungen an den Kanten geben Protokoll, Port und — bei MQTT — das Topic an.

```mermaid
flowchart TB
  subgraph SensorNodes["EdgeCloud_Sensor (Hardware-Ebene)"]
    hub["ESP32-S3 Sensor-Hub<br/>«device»<br/>AHT20 · BMP280 · VL53L0X · MQ-2"]
    cam["ESP32-CAM Vision-Knoten<br/>«device»<br/>MJPEG-Streamer"]
    sim["Python-Simulatoren<br/>«optional»<br/>Hardware-/Backend-Ersatz"]
  end

  subgraph MainHost["EdgeCloud_Main (Docker Compose)"]
    broker["Mosquitto Broker<br/>«container»<br/>Ports 1883 / 9001"]
    engine["engine<br/>«container»<br/>Regel-/Zustands-Engine"]
    app["app<br/>«container»<br/>LLM-Anreicherung"]
    bridge["bridge<br/>«container»<br/>MQTT → WebSocket<br/>Port 8081"]
  end

  browser["Browser-Dashboard<br/>«EdgeCloud, React/Vite»"]
  gemini["Google Gemini API<br/>«external»<br/>OpenAI-kompatibel"]
  vlm["Lokaler VLM-Server<br/>«external»<br/>EPYC/RTX, Vision-KI"]

  hub -- "MQTT/TCP:1883<br/>PUB edge/observations/room/101" --> broker
  sim -. "MQTT/TCP:1883 (Ersatz)" .-> broker
  cam -- "HTTP:81 MJPEG /stream (Pull)" --> vlm

  broker -- "SUB edge/observations/room/101" --> engine
  engine -- "PUB edge/observations/normalized/room/101 (retained)" --> broker
  engine -- "PUB edge/alerts/room/101 (retained)" --> broker
  broker -- "SUB edge/alerts/room/101" --> app
  app -- "HTTPS (LLM-Aufruf)" --> gemini
  app -- "PUB edge/alerts/enriched/room/101 (retained)" --> broker

  broker -- "SUB normalized / alerts / enriched" --> bridge
  bridge -- "WebSocket:8081<br/>{type, data}" --> browser

  app -. "edge/request ↔ edge/response (LLM-Runde)" .-> broker
```

## Kernaussagen

- **Zentraler Hub ist der MQTT-Broker** (Mosquitto). Alle Main-Dienste verbinden sich mit Retry bis der Broker bereit ist.
- **Retained Messages** ersetzen eine Datenbank: spät verbundene Consumer (z. B. ein frisch geladenes Dashboard) erhalten sofort den aktuellen Zustand.
- Das **LLM ist bewusst außerhalb des Entscheidungspfads** — es liefert nur Narration (`app`), niemals Severity-Werte.
- **Sicherheit ist noch nicht implementiert** (anonymer Broker, Crypto-Stubs) — hier als offener Punkt zu kennzeichnen.
