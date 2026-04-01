import json
import logging
import time

import paho.mqtt.client as mqtt

from config import MQTT_BROKER, MQTT_PORT, TOPIC_REQUEST, TOPIC_RESPONSE
from llm_client import ask_llm

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# to edge.request
def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        log.info("Connected to MQTT broker")
        client.subscribe(TOPIC_REQUEST, qos=1)
        log.info("Subscribed to %s", TOPIC_REQUEST)
    else:
        log.error("Connection failed: %s", reason_code)


def on_message(client, userdata, msg):
    """Handle incoming MQTT messages from ESP32."""
    try:
        payload = json.loads(msg.payload.decode())
    except (json.JSONDecodeError, UnicodeDecodeError):
        log.warning("Invalid payload on %s: %s", msg.topic, msg.payload)
        return

    device_id = payload.get("device_id", "unknown")
    prompt = payload.get("prompt", "")
    log.info("Request from %s: %s", device_id, prompt[:80])

    if not prompt:
        return

    answer = ask_llm(prompt)
    log.info("LLM response (%d chars)", len(answer))

    response = json.dumps({
        "device_id": device_id,
        "response": answer,
    })
    client.publish(TOPIC_RESPONSE, response, qos=1)


def main():
    mqttc = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    mqttc.on_connect = on_connect
    mqttc.on_message = on_message

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
