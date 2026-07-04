# Main — Komponenten-/Verteilungsdiagramm

Vier Docker-Compose-Container plus externe Gemini-API. Die Komponenten kommunizieren ausschließlich über MQTT-Topics (der Broker ist die einzige Kopplung); nur `bridge` öffnet zusätzlich einen WebSocket-Server nach außen.

```mermaid
flowchart TB
  subgraph Compose["docker-compose.yml (Host)"]
    broker["mosquitto<br/>«container: eclipse-mosquitto:2»<br/>Listener 1883 TCP / 9001 WS<br/>anonym erlaubt · persistence on"]
    engine["engine<br/>«container: python:3.12-slim»<br/>Regel-/Zustands-Engine"]
    app["app<br/>«container: python:3.12-slim»<br/>LLM-Anreicherung"]
    bridge["bridge<br/>«container: python:3.12-slim»<br/>MQTT → WebSocket :8081"]
    vol[("mosquitto_data /<br/>mosquitto_log<br/>«volume»")]
  end

  sensor["ESP32 Sensor-Knoten<br/>«external»"]
  browser["Browser-Dashboard<br/>«external»"]
  gemini["Google Gemini API<br/>«external, HTTPS»"]

  sensor -- "PUB edge/observations/room/101" --> broker
  broker -- "SUB observations" --> engine
  engine -- "PUB normalized + alerts (retained)" --> broker
  broker -- "SUB alerts" --> app
  app -- "HTTPS" --> gemini
  app -- "PUB enriched (retained)" --> broker
  broker -- "SUB normalized/alerts/enriched" --> bridge
  bridge -- "WS :8081 {type,data}" --> browser
  broker --- vol

  classDef planned stroke-dasharray:4 3,stroke:#b45309;
  sec["Sicherheit: TLS + AES<br/>(app/crypto.py = No-Op-Stubs)<br/>Broker anonym"]:::planned
  sec -. "geplant / nicht implementiert" .-> broker
```

## Kernaussagen

- **Keine Applikationsdatenbank.** Persistenz nur über MQTT-**Retained Messages** + Mosquitto-Volumes. Der In-Memory-Zustand (`RoomState`, App-Dedup-Dict, Bridge-Caches) geht bei Neustart verloren.
- **Externe Integration**: LLM über beliebigen OpenAI-kompatiblen Endpunkt (aktuell Gemini `gemini-2.5-flash`), per `.env` austauschbar.
- **Logging**: loguru mit rotierenden Dateilogs (10 MB / 7 Tage / gz).
- **Sicherheit**: als geplant/offen markiert (anonymer Broker, Crypto-Stubs).
