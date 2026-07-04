# Dashboard — Komponentendiagramm

Interne Struktur der React-Anwendung. Der Hook `useDashboardStream` wirkt als zentraler Controller/Façade; `App` verteilt Zustand und Callbacks an acht Panels.

```mermaid
flowchart TB
  subgraph Sources["Datenquellen (ConnectionMode)"]
    ws["server-websocket<br/>VITE_WS_URL"]
    sim["local-observation-simulation<br/>3s-Timer"]
    manual["manual-json<br/>ObservationInputPanel"]
  end

  hook["useDashboardStream<br/>«hook / controller»<br/>hält data, streaming, backendAlerts,<br/>enrichments; Aktions-API"]

  subgraph Lib["lib-Pipeline"]
    derive["deriveDashboardState"]
    risk["riskEngine"]
    alert["alertEngine"]
    device["deviceEngine"]
    robot["robot"]
    overall["risk (deriveOverallSeverity)"]
  end

  app["App.tsx<br/>«root layout»"]

  subgraph Panels["Panels.tsx (8 Panels)"]
    p1["PatientStatusPanel"]
    p2["EnvironmentPanel"]
    p3["HealthSummaryPanel"]
    p4["AlertsPanel + AiEnrichment"]
    p5["DevicesPanel"]
    p6["PrivacyPanel"]
    p7["RobotPanel"]
    p8["AuditPanel"]
  end

  header["Header.tsx<br/>Badges + Steuerbuttons"]
  input["ObservationInputPanel.tsx"]
  common["common.tsx<br/>Panel · StatusBadge · TrendSnippet · TrendZoomModal"]

  ws --> hook
  sim --> hook
  manual --> hook
  hook --> derive
  derive --> risk
  derive --> alert
  derive --> device
  alert --> risk
  hook --> robot
  robot --> overall
  hook --> app
  app --> header
  app --> Panels
  app --> input
  Panels --> common
  header --> hook
  input --> hook
  p1 -. "onSelectPatient" .-> hook
  p7 -. "buildRobotOptions" .-> robot
```

## Kernaussagen

- **`useDashboardStream` ist die einzige Zustandsquelle** (kein Redux/MobX). Er besitzt `data: DashboardData` sowie die gesamte Aktions-API (Ingestion, Lifecycle, Simulation, Alarm-Workflow, Roboter-Workflow).
- **`EnvironmentPanel`** zeigt die echten ESP32-Raumdaten (im lokalen Simulationsmodus leer).
- **`AlertsPanel`** versöhnt lokale Alarme mit den autoritativen `backendAlerts` ("Engine-Strip") und zeigt die LLM-`enrichments`.
- **`common.tsx`** liefert wiederverwendbare Primitive inkl. SVG-Zeitreihen (`TrendSnippet`, `TrendZoomModal`).
