# System — Anwendungsfalldiagramm

Akteure und ihre Anwendungsfälle über das Gesamtsystem. Mermaid kennt kein natives Use-Case-Diagramm; es wird als Graph mit ovalen Anwendungsfällen (Ellipsen) und rechteckigen Akteuren modelliert.

```mermaid
flowchart LR
  operator([Operator]):::actor
  nurse([Pflegepersonal]):::actor
  patient([Patient]):::actor
  sensordev([Sensor-Geräte]):::actor
  llm([LLM-Dienst]):::actor

  subgraph System["Secure MedTech Companion"]
    uc1(("Raumstatus<br/>überwachen"))
    uc2(("Alarm bestätigen<br/>(acknowledge)"))
    uc3(("Alarm auflösen<br/>(resolve)"))
    uc4(("Alarm eskalieren<br/>(escalate)"))
    uc5(("Patient als<br/>geprüft markieren"))
    uc6(("Roboterbefehl<br/>senden"))
    uc7(("Patientenantwort<br/>erfassen"))
    uc8(("Manuellen JSON-Test<br/>durchführen"))
    uc9(("Beobachtungen<br/>liefern"))
    uc10(("Umgebungs-/Geräte-<br/>status empfangen"))
    uc11(("Alarm sprachlich<br/>anreichern"))
  end

  operator --- uc1
  operator --- uc2
  operator --- uc3
  operator --- uc4
  operator --- uc5
  operator --- uc6
  operator --- uc7
  operator --- uc8
  operator --- uc10

  uc6 -. "include" .-> uc7
  patient --- uc7
  nurse --- uc4
  sensordev --- uc9
  sensordev --- uc10
  llm --- uc11
  uc2 -. "extend" .-> uc11

  classDef actor fill:#e8eef7,stroke:#33455f,stroke-width:1px;
```

## Erläuterung der Akteure

- **Operator** — Hauptnutzer der Dashboard-UI; steuert den gesamten Alarm- und Roboter-Workflow.
- **Pflegepersonal** — Empfänger von Eskalationen/Benachrichtigungen (`staffNotification` in Roboterbefehlen).
- **Patient** — interagiert mit dem Roboter (Sprachaufforderung, Antwortbestätigung).
- **Sensor-Geräte** — ESP32-Hub/Kamera liefern Beobachtungen und Umgebungsdaten.
- **LLM-Dienst** — externer Gemini-Endpunkt, erzeugt ausschließlich Narration.
