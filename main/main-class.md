# Main — Klassendiagramm

Die Python-Backend-Schicht. `engine` ist der klassenreichste Dienst (`PatientState`, `RoomState`); `app` und `bridge` bestehen überwiegend aus Modulfunktionen (`«module»`). Ankerdateien: `engine/*.py`, `app/*.py`, `bridge/bridge.py`.

```mermaid
classDiagram
  direction LR

  class PatientState {
    +float window
    +deque samples
    +float time_immobile
    +float last_epoch
    +dict last_alert
    +update_immobility(motion, posture, epoch, incoming) float
    +reference(epoch) tuple
    +add_sample(epoch, metrics)
    +alert_lifecycle(alert_id, timestamp) str
    +clear_alert()
  }
  class RoomState {
    +float window
    +dict~str,PatientState~ patients
    +get(patient_id) PatientState
  }

  class rules {
    <<module>>
    +calculate_risk(tracking, vitals, immobile) tuple
    +detect_changes(current, reference, span) tuple
    +severity_from_score(score) str
    +derive_motion_state(motion) str
    +alert_title(severity) str
  }
  class normalize {
    <<module>>
    +normalize_observation(obs) dict
    -_complete_patient(p)
    -_room_occupancy()
    -dict _door_state
  }
  class engine {
    <<module / entry>>
    +evaluate_patient(patient, ts, epoch) dict
    +on_message(client, userdata, msg)
    +on_connect()
    +main()
    +RoomState room
  }
  class enrich {
    <<module>>
    +enrich_alert(alert) dict
    +build_prompt(alert) str
    -_fallback(alert) dict
  }
  class llm_client {
    <<module>>
    +ask_llm(prompt, model) str
    +OpenAI client
  }
  class crypto {
    <<module / stub>>
    +configure_tls()  NO-OP
    +decrypt_payload(p)  NO-OP
    +encrypt_payload(p)  NO-OP
  }
  class app_main {
    <<module / entry>>
    +on_alert_snapshot(client, payload)
    +on_message(client, userdata, msg)
    +main()
    -dict _enriched_alert_ids
  }
  class bridge {
    <<module / entry>>
    +make_mqtt_client(loop, queue)
    +broadcaster(queue)
    +handler(websocket)
    +set clients
    +dict last_by_type
    +main()
  }

  RoomState "1" *-- "0..*" PatientState
  engine ..> RoomState
  engine ..> rules : nutzt
  engine ..> normalize : nutzt
  engine ..> PatientState : via RoomState.get()
  app_main ..> enrich
  app_main ..> crypto
  enrich ..> llm_client
  bridge ..> "MQTT + asyncio websockets"
```

## Kernaussagen

- **`rules` ist rein und zustandslos** (unit-testbar in `test_rules.py`). `calculate_risk` ist als Portierung des Dashboard-`riskEngine.ts` dokumentiert; `detect_changes` liefert die Rate-of-Change-Erkennung (`HR_RAPID_CHANGE`, `SPO2_RAPID_DROP`, `FALLPROB_SURGE`, `TEMP_RAPID_RISE`), die das Dashboard nicht hat.
- **`PatientState` hält genau das, was Snapshot-Regeln nicht selbst berechnen können**: rollierende Historie (`samples`), akkumulierte Immobilität und den aktiven Alarm (für Dedup/Lifecycle via `alert_lifecycle`).
- **`normalize`** vervollständigt den unvollständigen ESP32-Feed zum kanonischen Schema, leitet die Sensor-Umgebungstemperatur in `environment` um und zählt die Türbelegung.
- **`crypto`** ist bewusst ein No-Op-Stub (TLS/AES nicht implementiert).
- **`enrich`** degradiert bei jedem LLM-Fehler deterministisch auf `_fallback` — das LLM ist nie im Entscheidungspfad.
