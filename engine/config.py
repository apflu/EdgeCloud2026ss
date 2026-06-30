import os

# ── Logging ───────────────────────────────────────────────────────────
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
LOG_FILE = os.environ.get("LOG_FILE", "logs/engine.log")

# ── MQTT ──────────────────────────────────────────────────────────────
MQTT_BROKER = os.environ.get("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))

# Facts in, authoritative alerts out — kept on separate topics so the clean
# "server sends facts, decisions live elsewhere" contract is preserved.
#
# OBSERVATION_TOPIC is the RAW edge-node feed (the ESP32 sensor hub publishes a
# partial payload here). The engine completes it to the canonical schema (see
# normalize.py) and republishes the full observation to OBSERVATION_OUT_TOPIC,
# which the bridge/dashboard consume. The two must differ to avoid a self-loop.
OBSERVATION_TOPIC = os.environ.get("OBSERVATION_TOPIC", "edge/observations/room/101")
OBSERVATION_OUT_TOPIC = os.environ.get("OBSERVATION_OUT_TOPIC", "edge/observations/normalized/room/101")
ALERTS_TOPIC = os.environ.get("ALERTS_TOPIC", "edge/alerts/room/101")

# ── Rate-of-change detection ──────────────────────────────────────────
# Lookback window (seconds) for "drastic parameter change" rules. A metric is
# compared against the oldest sample still inside this window.
CHANGE_WINDOW_SECONDS = float(os.environ.get("CHANGE_WINDOW_SECONDS", "30"))
