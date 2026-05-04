"""
Pydantic AI agent setup.

The agent is created from config (system prompt, model). When USE_LITELLM is set
(or LITELLM_SERVER_URL + LITELLM_API_KEY are set), the agent uses the LiteLLM
provider pointing at your LiteLLM server; otherwise it uses OpenAI (or the
provider in DEFAULT_MODEL) with OPENAI_API_KEY.

Optional tools from extension_points (e.g. MCP, custom tools) are registered
after creation so the model can call them during the conversation.
"""
import datetime

from pydantic_ai import Agent, RunContext
from pydantic_ai.models import Model

from chatbot.config import (
    DEFAULT_MODEL,
    DEFAULT_SYSTEM_PROMPT,
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

agent = Agent(
    _model, 
    instructions=DEFAULT_SYSTEM_PROMPT, 
    capabilities=[])

@agent.tool
def get_current_time(context: RunContext[None]) -> str:
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

