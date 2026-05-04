from pydantic_ai.models import Model
from pydantic_deep import create_deep_agent

from chatbot.config import (
    DEFAULT_MODEL,
    LITELLM_API_KEY,
    LITELLM_MODEL,
    LITELLM_SERVER_URL,
    use_litellm,
)

_model: str | Model

if use_litellm():
    # Use LiteLLM: point at your LiteLLM server (proxy). Requires LITELLM_SERVER_URL
    # and LITELLM_API_KEY to be set. The server must be running and configured
    # to route the model name (e.g. openai/gpt-4o-mini) to the right provider.
    from pydantic_ai.models.openai import OpenAIChatModel
    from pydantic_ai.providers.litellm import LiteLLMProvider

    _provider = LiteLLMProvider(api_base=LITELLM_SERVER_URL, api_key=LITELLM_API_KEY or "litellm-placeholder")
    _model = OpenAIChatModel(LITELLM_MODEL, provider=_provider)
else:
    # Use OpenAI (or other provider) directly via DEFAULT_MODEL and env keys
    # (e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY).
    _model = DEFAULT_MODEL


agent = create_deep_agent(model=_model)
