import json
import time

import paho.mqtt.client as mqtt

from config import (
    MQTT_BROKER,
    MQTT_PORT,
    TOPIC_ALERTS,
    TOPIC_ALERTS_ENRICHED,
    TOPIC_REQUEST,
    TOPIC_RESPONSE,
)
from crypto import configure_tls, decrypt_payload, encrypt_payload
from enrich import enrich_alert
from logger import log
from llm_client import ask_llm

# Last alert id we enriched per patient, so the (retained, ~per-cycle) alert
# snapshot only triggers an LLM call when something actually changed.
_enriched_alert_ids: dict[str, str] = {}


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        log.info("Connected to MQTT broker")
        client.subscribe(TOPIC_REQUEST, qos=1)
        log.info("Subscribed to {}", TOPIC_REQUEST)
        client.subscribe(TOPIC_ALERTS, qos=1)
        log.info("Subscribed to {}", TOPIC_ALERTS)
    else:
        log.error("Connection failed: {}", reason_code)


def on_alert_snapshot(client, payload: bytes):
    """Enrich newly-changed alerts and publish narration to TOPIC_ALERTS_ENRICHED.

    The engine republishes the full alert snapshot every cycle; we only call the
    LLM when a patient's alert id is new or changed, and forget patients that
    have cleared so a later re-escalation gets freshly narrated.
    """
    try:
        snapshot = json.loads(payload.decode())
    except (json.JSONDecodeError, UnicodeDecodeError):
        log.warning("Invalid alert snapshot payload")
        return

    alerts = snapshot.get("alerts", [])
    active_patient_ids = {alert.get("patientId") for alert in alerts}

    # Drop patients that are no longer alerting (lets re-escalation re-enrich).
    for patient_id in list(_enriched_alert_ids):
        if patient_id not in active_patient_ids:
            _enriched_alert_ids.pop(patient_id, None)

    for alert in alerts:
        patient_id = alert.get("patientId")
        alert_id = alert.get("id")
        if _enriched_alert_ids.get(patient_id) == alert_id:
            continue  # already narrated this exact alert — skip the LLM

        log.info("Enriching {} ({})", alert_id, alert.get("severity"))
        enrichment = enrich_alert(alert)
        _enriched_alert_ids[patient_id] = alert_id

        enriched_message = {
            "roomId": snapshot.get("roomId", ""),
            "timestamp": snapshot.get("timestamp", ""),
            "alertId": alert_id,
            "patientId": patient_id,
            "severity": alert.get("severity"),
            **enrichment,
        }
        client.publish(TOPIC_ALERTS_ENRICHED, json.dumps(enriched_message), qos=1, retain=True)
        log.info("Published enrichment for {}: {}", alert_id, enrichment["summary"][:80])


def on_message(client, userdata, msg):
    """Route incoming MQTT messages by topic.

    edge/alerts/...  -> LLM enrichment of engine-derived alerts.
    edge/request     -> direct device LLM request/response (below). Expected:
        {
            "device_id": "esp32-01",
            "prompt": "Hello, what is the weather?",
            "model": "llama3"          // optional, overrides default
        }
    """
    if msg.topic == TOPIC_ALERTS:
        on_alert_snapshot(client, msg.payload)
        return

    # TODO: decrypt_payload() is a no-op stub — wire up real AES decryption
    #       once the key provisioning strategy is decided.
    raw = decrypt_payload(msg.payload, device_id=None)

    try:
        payload = json.loads(raw.decode())
    except (json.JSONDecodeError, UnicodeDecodeError):
        log.warning("Invalid payload on {}: {}", msg.topic, msg.payload)
        return

    device_id = payload.get("device_id", "unknown")
    prompt = payload.get("prompt", "")
    model = payload.get("model")  # None → use default

    log.info("Request from {} (model={}): {}", device_id, model or "default", prompt[:80])

    if not prompt:
        return

    answer = ask_llm(prompt, model=model)
    log.info("LLM response ({} chars)", len(answer))

    response = json.dumps({
        "device_id": device_id,
        "model": model,
        "response": answer,
    })
    # TODO: encrypt_payload() is a no-op stub — wire up real AES encryption
    encrypted = encrypt_payload(response.encode(), device_id=device_id)
    client.publish(TOPIC_RESPONSE, encrypted, qos=1)


def main():
    log.info("EdgeCloud starting up")
    mqttc = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    mqttc.on_connect = on_connect
    mqttc.on_message = on_message

    # TODO: configure_tls() is a no-op stub — enable when certs are ready
    configure_tls(mqttc)

    while True:
        try:
            mqttc.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            break
        except ConnectionRefusedError:
            log.info("Waiting for MQTT broker...")
            time.sleep(2)

    mqttc.loop_forever()


if __name__ == "__main__":
    main()
