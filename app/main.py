import json
import time

import paho.mqtt.client as mqtt

from config import MQTT_BROKER, MQTT_PORT, TOPIC_REQUEST, TOPIC_RESPONSE
from crypto import configure_tls, decrypt_payload, encrypt_payload
from logger import log
from llm_client import ask_llm


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        log.info("Connected to MQTT broker")
        client.subscribe(TOPIC_REQUEST, qos=1)
        log.info("Subscribed to {}", TOPIC_REQUEST)
    else:
        log.error("Connection failed: {}", reason_code)


def on_message(client, userdata, msg):
    """Handle incoming MQTT messages from ESP32.

    Expected JSON payload:
        {
            "device_id": "esp32-01",
            "prompt": "Hello, what is the weather?",
            "model": "llama3"          // optional, overrides default
        }
    """
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
