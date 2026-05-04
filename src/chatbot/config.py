"""
Extension point: System prompt and model selection.

Change DEFAULT_SYSTEM_PROMPT and DEFAULT_MODEL here to adapt the chatbot's
personality and which LLM provider/model it uses. You can also load these
from environment variables or a config file for different environments.

Backend mode (flag):
- Use OpenAI directly when OPENAI_API_KEY is set and USE_LITELLM is not set.
- Use LiteLLM when USE_LITELLM=1 (or when LITELLM_API_KEY and LITELLM_SERVER_URL are set).
  LiteLLM requires a running LiteLLM server (or proxy) and the corresponding API key.
"""

import os
from typing import Any

import httpx
from dotenv import load_dotenv

# Load environment variables from a local `.env` file (if present).
# This must happen before reading `os.environ` below, since several settings
# are evaluated at import time.
load_dotenv()

# Default instructions sent to the model as the "system" role. This shapes
# how the assistant responds (tone, scope, rules).
DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful, friendly assistant. "
    "Answer concisely and clearly. If you don't know something, say so."
)

# Model identifier for OpenAI (or for LiteLLM, the model name passed to the proxy).
# Examples: "gpt-4o-mini", "openai/gpt-4o-mini" (LiteLLM format when using a proxy).
DEFAULT_MODEL = "openai:gpt-4o-mini"

# --- Backend selection: OpenAI direct vs LiteLLM ---
# Set USE_LITELLM=1 (or true/yes) to send requests to a LiteLLM server instead of OpenAI.
# When using LiteLLM, you must set LITELLM_SERVER_URL and LITELLM_API_KEY.
USE_LITELLM_ENV = os.environ.get("USE_LITELLM", "").strip().lower() in ("1", "true", "yes")
LITELLM_SERVER_URL_ENV = os.environ.get("LITELLM_SERVER_URL", "").strip() or None
LITELLM_API_KEY_ENV = os.environ.get("LITELLM_API_KEY", "").strip() or None

# Use LiteLLM if the flag is set or if both LiteLLM URL and key are present.
def use_litellm() -> bool:
    if USE_LITELLM_ENV:
        return True
    return bool(LITELLM_SERVER_URL_ENV and LITELLM_API_KEY_ENV)

# LiteLLM server URL (e.g. http://localhost:4000 or http://localhost:4000/v1 if the proxy exposes the API under /v1).
# The LiteLLM server must be running and configured to proxy to your desired providers.
LITELLM_SERVER_URL = LITELLM_SERVER_URL_ENV or "http://localhost:4000"

# API key for the LiteLLM server. Some setups use a placeholder; others require a key.
LITELLM_API_KEY = LITELLM_API_KEY_ENV or ""

# Model name sent to LiteLLM (e.g. "openai/gpt-4o-mini" to use OpenAI via LiteLLM).
LITELLM_MODEL = os.environ.get("LITELLM_MODEL", "").strip() or "gpt-4o-mini"


def get_litellm_supported_models(timeout_s: float = 5.0) -> list[str]:
    """
    Retrieve supported model IDs from the configured LiteLLM server.

    This calls the OpenAI-compatible `GET /v1/models` endpoint exposed by the LiteLLM proxy.
    The request uses `LITELLM_SERVER_URL` and authenticates with `LITELLM_API_KEY` when set.

    Returns an empty list if LiteLLM is not configured or the request fails.
    """
    if not use_litellm():
        return []

    base = LITELLM_SERVER_URL.rstrip("/")
    api_base = base if base.endswith("/v1") else f"{base}/v1"
    url = f"{api_base}/models"

    headers: dict[str, str] = {}
    if LITELLM_API_KEY:
        # Common LiteLLM proxy auth patterns.
        headers["Authorization"] = f"Bearer {LITELLM_API_KEY}"
        headers["x-api-key"] = LITELLM_API_KEY

    try:
        resp = httpx.get(url, headers=headers, timeout=timeout_s)
        resp.raise_for_status()
        payload: Any = resp.json()
    except Exception:
        return []

    data = payload.get("data")
    if not isinstance(data, list):
        return []

    models: list[str] = []
    for item in data:
        if isinstance(item, dict):
            model_id = item.get("id")
            if isinstance(model_id, str) and model_id.strip():
                models.append(model_id)

    # Stable output, avoid duplicates.
    return sorted(set(models))

