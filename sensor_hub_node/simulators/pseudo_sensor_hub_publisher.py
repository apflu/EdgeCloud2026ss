"""
Pseudo Sensor Hub Publisher
---------------------------
Simulates the ESP32-S3 sensor_hub_node without hardware.
It publishes room-level sensor data to MQTT using the same kind of JSON that
sensor_hub_node/src/main.cpp publishes.

Use this when the real ESP32-S3 or sensors are not available yet.
"""

from __future__ import annotations

import argparse
import json
import random
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

DEFAULT_TOPIC = "edge/sensors/waiting_room_1/hub"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


class SensorHubSimulation:
    def __init__(self) -> None:
        self.temperature_c = 22.4
        self.humidity_percent = 45.0
        self.pressure_hpa = 1013.0
        self.door_distance_mm = 1350
        self.gas_adc_level = 420
        self.battery_percent = 87

    def next_payload(self) -> dict:
        self.temperature_c = clamp(self.temperature_c + random.uniform(-0.15, 0.18), 18.0, 30.0)
        self.humidity_percent = clamp(self.humidity_percent + random.uniform(-0.7, 0.7), 25.0, 75.0)
        self.pressure_hpa = clamp(self.pressure_hpa + random.uniform(-0.4, 0.4), 990.0, 1035.0)
        self.door_distance_mm = int(clamp(self.door_distance_mm + random.randint(-80, 90), 150, 2200))
        self.gas_adc_level = int(clamp(self.gas_adc_level + random.randint(-20, 25), 100, 1600))
        self.battery_percent = int(clamp(self.battery_percent - random.choice([0, 0, 0, 1]), 0, 100))

        # Occasional realistic events.
        event = random.choices(
            ["normal", "person_near_door", "gas_spike"],
            weights=[0.82, 0.12, 0.06],
            k=1,
        )[0]
        if event == "person_near_door":
            self.door_distance_mm = random.randint(250, 650)
        elif event == "gas_spike":
            self.gas_adc_level = random.randint(1050, 1600)

        return {
            "device_id": "esp32-s3-sensor-hub-01",
            "room": "waiting_room_1",
            "timestamp": now_iso(),
            "temperature_c": round(self.temperature_c, 1),
            "humidity_percent": round(self.humidity_percent, 1),
            "pressure_hpa": round(self.pressure_hpa, 1),
            "door_distance_mm": self.door_distance_mm,
            "gas_adc_level": self.gas_adc_level,
            "battery_percent": self.battery_percent,
            "status": "ok",
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish pseudo ESP32-S3 sensor hub data to MQTT.")
    parser.add_argument("--broker", default="localhost", help="MQTT broker host/IP. Default: localhost")
    parser.add_argument("--port", type=int, default=1883, help="MQTT broker port. Default: 1883")
    parser.add_argument("--topic", default=DEFAULT_TOPIC, help=f"MQTT topic. Default: {DEFAULT_TOPIC}")
    parser.add_argument("--interval", type=float, default=3.0, help="Publish interval in seconds. Default: 3")
    args = parser.parse_args()

    simulation = SensorHubSimulation()
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.connect(args.broker, args.port, 60)
    client.loop_start()

    print(f"Publishing pseudo sensor hub data to mqtt://{args.broker}:{args.port}/{args.topic}")
    try:
        while True:
            payload = simulation.next_payload()
            raw = json.dumps(payload, separators=(",", ":"))
            result = client.publish(args.topic, raw, qos=1)
            result.wait_for_publish()
            print(json.dumps(payload, indent=2))
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nStopped pseudo sensor hub publisher.")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
