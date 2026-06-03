"""
MQTT → WebSocket bridge
-----------------------
Subscribes to the patient-observation topic on the local MQTT broker and
re-broadcasts every message, verbatim, to all connected browser WebSocket
clients.

Why this exists:
    The Secure MedTech dashboard runs in the browser and cannot speak raw TCP
    MQTT (port 1883). It already supports a plain WebSocket source (VITE_WS_URL)
    that expects each message to be a patient-observation JSON — which is
    exactly what the sensor layer publishes to OBSERVATION_TOPIC. This bridge is
    the glue between the two: no payload transformation, only transport
    translation (MQTT TCP -> WebSocket).

Data path:
    EdgeCloud_Sensor simulator
        -> MQTT  edge/observations/room/101  (mosquitto:1883)
        -> this bridge
        -> WebSocket  ws://<host>:8081
        -> EdgeCloud dashboard (browser)
"""

from __future__ import annotations

import asyncio
import os
import time

import paho.mqtt.client as mqtt
import websockets
from loguru import logger as log

# ── MQTT ──────────────────────────────────────────────────────────────
MQTT_BROKER = os.environ.get("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
# Topic carrying the dashboard-ready patient observation JSON. Matches the
# default used by EdgeCloud_Sensor's pseudo_patient_observation_publisher.py.
OBSERVATION_TOPIC = os.environ.get("OBSERVATION_TOPIC", "edge/observations/room/101")

# ── WebSocket server (what the browser dashboard connects to) ─────────
WS_HOST = os.environ.get("WS_HOST", "0.0.0.0")
WS_PORT = int(os.environ.get("WS_PORT", "8081"))


# Connected dashboard sockets and the most recent observation, so a freshly
# opened dashboard sees data immediately instead of waiting for the next tick.
clients: set[websockets.WebSocketServerProtocol] = set()
last_message: str | None = None


def make_mqtt_client(loop: asyncio.AbstractEventLoop, queue: "asyncio.Queue[str]") -> mqtt.Client:
    """Create a paho client that hands each observation to the asyncio loop.

    paho runs its own network thread, so messages are pushed onto the asyncio
    queue thread-safely; the broadcaster task (in the loop) does the fan-out.
    """

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

    def on_connect(_client, _userdata, _flags, reason_code, _properties):
        if reason_code == 0:
            log.info("Connected to MQTT broker {}:{}", MQTT_BROKER, MQTT_PORT)
            _client.subscribe(OBSERVATION_TOPIC, qos=1)
            log.info("Subscribed to {}", OBSERVATION_TOPIC)
        else:
            log.error("MQTT connection failed: {}", reason_code)

    def on_message(_client, _userdata, msg):
        try:
            payload = msg.payload.decode()
        except UnicodeDecodeError:
            log.warning("Dropping non-UTF8 payload on {}", msg.topic)
            return
        # Hop from paho's thread into the asyncio loop.
        loop.call_soon_threadsafe(queue.put_nowait, payload)

    client.on_connect = on_connect
    client.on_message = on_message
    return client


async def broadcaster(queue: "asyncio.Queue[str]") -> None:
    """Fan out each observation to every connected dashboard."""
    global last_message
    while True:
        payload = await queue.get()
        last_message = payload
        if not clients:
            continue
        results = await asyncio.gather(
            *(ws.send(payload) for ws in clients),
            return_exceptions=True,
        )
        dead = sum(1 for r in results if isinstance(r, Exception))
        if dead:
            log.debug("Broadcast to {} clients, {} send errors", len(clients), dead)


async def handler(websocket: "websockets.WebSocketServerProtocol") -> None:
    """Track one dashboard connection and replay the latest observation."""
    clients.add(websocket)
    log.info("Dashboard connected ({} total)", len(clients))
    try:
        if last_message is not None:
            await websocket.send(last_message)
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
    queue: "asyncio.Queue[str]" = asyncio.Queue()

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
