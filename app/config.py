import os

# ── Logging ───────────────────────────────────────────────────────────
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
LOG_FILE = os.environ.get("LOG_FILE", "logs/edgecloud.log")

# ── MQTT ──────────────────────────────────────────────────────────────
MQTT_BROKER = os.environ.get("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))

TOPIC_REQUEST = "edge/request"
TOPIC_RESPONSE = "edge/response"

# Authoritative alerts from the rule/state engine (input) and the LLM-enriched
# narration this service produces from them (output). Enrichment NEVER changes
# the alert decision — it only explains an alert the engine already fired.
TOPIC_ALERTS = os.environ.get("TOPIC_ALERTS", "edge/alerts/room/101")
TOPIC_ALERTS_ENRICHED = os.environ.get("TOPIC_ALERTS_ENRICHED", "edge/alerts/enriched/room/101")

# Skip LLM enrichment for alert snapshots older than this many seconds. The
# engine only emits alerts in response to observations, so when the simulator
# stops the stream goes quiet — but the broker keeps handing us snapshots that
# were already queued while the (slow) LLM calls ran. Enriching those narrates
# stale state and burns tokens after the data has stopped. Dropping them makes
# the LLM effectively pause when no fresh observations are arriving, and lets
# the app shed a backlog instead of grinding through it.
MAX_ALERT_AGE_SECONDS = float(os.environ.get("MAX_ALERT_AGE_SECONDS", "10"))

# ── LLM Endpoint ─────────────────────────────────────────────────────
# Base URL of any OpenAI-compatible API (Ollama, vLLM, LM Studio, etc.)
# Examples:
#   http://192.168.1.100:11434/v1   (Ollama)
#   http://10.0.0.5:8000/v1         (vLLM)
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://localhost:11434/v1")

# API key — leave empty for local services that don't require auth
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")

# Default model (can be overridden per-request via MQTT payload)
LLM_DEFAULT_MODEL = os.environ.get("LLM_DEFAULT_MODEL", "llama3")

LLM_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "1024"))
