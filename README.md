# UML-Dokumentation — Secure MedTech Companion (EdgeCloud)

Diese Sammlung enthält die UML-Diagramme (als **Mermaid**) für das Gesamtsystem "Secure MedTech Companion", ein System zur Überwachung von Krankenhaus-Warte-/Patientenzimmern. Das System besteht aus drei unabhängigen Git-Repositories:

| Projekt | Pfad | Technologie | Rolle |
|---|---|---|---|
| **Dashboard** | `d:\test\EdgeCloud` | React 18 + TypeScript + Vite | Visualisierungs-, Bediener- und Roboter-Schnittstelle |
| **Main** | `d:\test\EdgeCloud_Main` | Python 3.12 + MQTT (4 Container) | Regel-Engine, LLM-Anreicherung, MQTT→WebSocket-Bridge |
| **Sensor** | `d:\test\EdgeCloud_Sensor` | ESP32 (C++/Arduino) + Python-Simulatoren | Sensor-Hub + Kamera-Knoten |

> Hinweis zur Sprache: Fließtext und Diagramm-Beschriftungen sind auf **Deutsch**. Code-Bezeichner (Klassennamen, Methoden, MQTT-Topics, Feldnamen) bleiben im englischen Original, um die Rückverfolgbarkeit zum Quellcode zu wahren.

## Lesereihenfolge

1. **System** (`system/`) — der Gesamtüberblick über alle drei Projekte hinweg.
   - [System — Komponenten-/Verteilungsdiagramm](system/system-component-deployment.md)
   - [System — End-to-End-Sequenzdiagramm](system/system-sequence-e2e.md)
   - [System — Anwendungsfalldiagramm](system/system-usecase.md)
   - [System — Datenmodell (gemeinsamer JSON-Vertrag)](system/system-dataclass.md)
2. **Dashboard** (`dashboard/`) — [Klasse](dashboard/dashboard-class.md) · [Sequenz](dashboard/dashboard-sequence.md) · [Komponente](dashboard/dashboard-component.md) · [Zustand](dashboard/dashboard-state.md)
3. **Main** (`main/`) — [Klasse](main/main-class.md) · [Sequenz](main/main-sequence.md) · [Komponente/Verteilung](main/main-component-deployment.md) · [Zustand](main/main-state.md)
4. **Sensor** (`sensor/`) — [Klasse](sensor/sensor-class.md) · [Sequenz](sensor/sensor-sequence.md) · [Komponente/Verteilung](sensor/sensor-component-deployment.md) · [Zustand](sensor/sensor-state.md)

## Datenfluss in einem Satz

```text
ESP32 / Simulatoren → MQTT-Broker → engine (Regel-Alarme) + app (LLM-Narration)
→ MQTT → bridge.py → WebSocket → Dashboard → deriveDashboardState → UI-Panels
```

## MQTT-Topics (Integrationsvertrag)

| Topic | Publisher | Subscriber | Inhalt |
|---|---|---|---|
| `edge/observations/room/101` | Sensor / Simulator | engine | Rohe, unvollständige Beobachtung |
| `edge/observations/normalized/room/101` | engine | bridge | Kanonische Beobachtung (retained) |
| `edge/alerts/room/101` | engine | app, bridge | Autoritative Alarme (retained) |
| `edge/alerts/enriched/room/101` | app | bridge | LLM-Narration (retained) |
| `edge/request` / `edge/response` | Gerät / app | app / Gerät | LLM-Anfrage-Runde |

Ports: MQTT `1883` (TCP) / `9001` (WS), bridge-WebSocket `8081`, Kamera-MJPEG `81`.

## Bekannte Inkonsistenzen / technische Schulden

Die Diagramme bilden den **tatsächlichen Code** ab, nicht die veraltete Dokumentation. Zu beachten:

1. **Topic-Inkonsistenz**: `main.cpp:23` publiziert `edge/observations/room/101`, während `sensor_hub_node/README.md` `karlsruhe/medical/sensor_hub` nennt und das Wurzel-README zusätzlich `edge/sensors/waiting_room_1/hub` auflistet. Die Firmware emittiert aktuell das *Observation*-Format und imitiert damit die Backend-/KI-Schicht (Dateikopf: "Python-Spoofing").
2. **Nur wenige echte Sensorfelder**: Real gemessen werden ausschließlich `tracking.distanceFromBedMeters` (ToF), `vitals.temperature` (Umgebungstemperatur) und `gas_adc_level`. Werte wie `heartRate`, `posture`, `fallProbability` sind auf dem Gerät fest codiert und sollen später von der serverseitigen Vision-/KI-Schicht stammen.
3. **RadarTracker** ist ein leerer Stub (0 Byte), **U8g2-OLED** ist deklariert, aber ungenutzt, der Zeitstempel wird aus `millis()` gefälscht.
4. **Sicherheit als Stub**: In Main sind TLS/AES in `app/crypto.py` reine Pass-through-No-Ops; der Broker erlaubt anonyme Verbindungen. In den Verteilungsdiagrammen als "geplant/nicht implementiert" markiert.

## Rendern / Export

- **VS Code**: Markdown-Vorschau mit Mermaid-Erweiterung, oder direkt auf GitHub.
- **Optionaler Bildexport**: `@mermaid-js/mermaid-cli` (`mmdc`) für SVG/PNG zur Verwendung in der Ausarbeitung.
