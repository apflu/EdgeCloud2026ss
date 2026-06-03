"""
MQTT → WebSocket bridge
-----------------------
Subscribes to the patient-observation, authoritative-alert and LLM-enriched
topics on the local MQTT broker and re-broadcasts each message to all connected
browser WebSocket clients.

Why this exists:
    The Secure MedTech dashboard runs in the browser and cannot speak raw TCP
    MQTT (port 1883). It already supports a plain WebSocket source (VITE_WS_URL).
    This bridge translates transport (MQTT TCP -> WebSocket) without changing the
    JSON the backend produces.

Envelope:
    Multiple topics share one socket, so every forwarded message is wrapped:
        {"type": "observation" | "alerts" | "enriched", "data": <original JSON>}
    The latest message of each type is cached and replayed to a freshly-opened
    dashboard so it shows full state immediately.

Data path:
    edge/observations/room/101      --\
    edge/alerts/room/101            ---> this bridge --> WebSocket --> dashboard
    edge/alerts/enriched/room/101   --/
"""

from __future__ import annotations

import asyncio
import json
import os
import time

import paho.mqtt.client as mqtt
import websockets
from loguru import logger as log

# ── MQTT ──────────────────────────────────────────────────────────────
MQTT_BROKER = os.environ.get("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
OBSERVATION_TOPIC = os.environ.get("OBSERVATION_TOPIC", "edge/observations/room/101")
ALERTS_TOPIC = os.environ.get("ALERTS_TOPIC", "edge/alerts/room/101")
ENRICHED_TOPIC = os.environ.get("ENRICHED_TOPIC", "edge/alerts/enriched/room/101")

# Topic -> envelope type. Order also defines the replay order on connect.
TYPE_BY_TOPIC = {
    OBSERVATION_TOPIC: "observation",
    ALERTS_TOPIC: "alerts",
    ENRICHED_TOPIC: "enriched",
}
REPLAY_ORDER = ["observation", "alerts", "enriched"]

# ── WebSocket server (what the browser dashboard connects to) ─────────
WS_HOST = os.environ.get("WS_HOST", "0.0.0.0")
WS_PORT = int(os.environ.get("WS_PORT", "8081"))


clients: set[websockets.WebSocketServerProtocol] = set()
# Latest enveloped message per type, so a new dashboard sees full state at once.
last_by_type: dict[str, str] = {}


def make_mqtt_client(loop: asyncio.AbstractEventLoop, queue: "asyncio.Queue[tuple[str, str]]") -> mqtt.Client:
    """Create a paho client that hands each message to the asyncio loop as
    (type, enveloped_json). paho runs its own thread, so we hop thread-safely."""

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

    def on_connect(_client, _userdata, _flags, reason_code, _properties):
        if reason_code == 0:
            log.info("Connected to MQTT broker {}:{}", MQTT_BROKER, MQTT_PORT)
            for topic in TYPE_BY_TOPIC:
                _client.subscribe(topic, qos=1)
                log.info("Subscribed to {}", topic)
        else:
            log.error("MQTT connection failed: {}", reason_code)

    def on_message(_client, _userdata, msg):
        msg_type = TYPE_BY_TOPIC.get(msg.topic)
        if msg_type is None:
            return
        try:
            data = json.loads(msg.payload.decode())
        except (UnicodeDecodeError, json.JSONDecodeError):
            log.warning("Dropping unparseable payload on {}", msg.topic)
            return
        envelope = json.dumps({"type": msg_type, "data": data}, separators=(",", ":"))
        loop.call_soon_threadsafe(queue.put_nowait, (msg_type, envelope))

    client.on_connect = on_connect
    client.on_message = on_message
    return client


async def broadcaster(queue: "asyncio.Queue[tuple[str, str]]") -> None:
    """Fan out each enveloped message to every connected dashboard."""
    while True:
        msg_type, envelope = await queue.get()
        last_by_type[msg_type] = envelope
        if not clients:
            continue
        results = await asyncio.gather(
            *(ws.send(envelope) for ws in clients),
            return_exceptions=True,
        )
        dead = sum(1 for r in results if isinstance(r, Exception))
        if dead:
            log.debug("Broadcast {} to {} clients, {} send errors", msg_type, len(clients), dead)


async def handler(websocket: "websockets.WebSocketServerProtocol") -> None:
    """Track one dashboard connection and replay the latest of each type."""
    clients.add(websocket)
    log.info("Dashboard connected ({} total)", len(clients))
    try:
        for msg_type in REPLAY_ORDER:
            cached = last_by_type.get(msg_type)
            if cached is not None:
                await websocket.send(cached)
        # Keep the connection open; the dashboard is a pure consumer.
        async for _ in websocket:
            pass
    except websockets.ConnectionClosed:
        pass
    finally:
        clients.discard(websocket)
        log.info("Dashboard disconnected ({} remaining)", len(clients))


async def main() -> None:
    log.info("MQTT->WebSocket bridge starting up")
    loop = asyncio.get_running_loop()
    queue: "asyncio.Queue[tuple[str, str]]" = asyncio.Queue()

    client = make_mqtt_client(loop, queue)

    # Mirror the app's connect-retry behaviour so the bridge survives a broker
    # that is still booting (docker depends_on only waits for start, not ready).
    while True:
        try:
            client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            break
        except (ConnectionRefusedError, OSError):
            log.info("Waiting for MQTT broker...")
            time.sleep(2)

    client.loop_start()

    async with websockets.serve(handler, WS_HOST, WS_PORT):
        log.info("WebSocket server listening on ws://{}:{}", WS_HOST, WS_PORT)
        await broadcaster(queue)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Bridge stopped.")
