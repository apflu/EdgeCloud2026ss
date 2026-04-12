import logging

from openai import OpenAI

from config import LLM_BASE_URL, LLM_API_KEY, LLM_DEFAULT_MODEL, LLM_MAX_TOKENS

log = logging.getLogger(__name__)

# OpenAI-compatible client pointing at the configured endpoint
client = OpenAI(
    base_url=LLM_BASE_URL,
    api_key=LLM_API_KEY or "not-needed",  # some servers require a non-empty string
)


def ask_llm(prompt: str, model: str | None = None) -> str:
    """Send a prompt to the LLM endpoint and return the response text.

    Args:
        prompt: The user prompt.
        model:  Model name to use. Falls back to LLM_DEFAULT_MODEL if not given.
    """
    model = model or LLM_DEFAULT_MODEL
    try:
        response = client.chat.completions.create(
            model=model,
            max_tokens=LLM_MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content
    except Exception as e:
        log.error("LLM request failed (model=%s, endpoint=%s): %s", model, LLM_BASE_URL, e)
        return f"LLM error: {e}"
