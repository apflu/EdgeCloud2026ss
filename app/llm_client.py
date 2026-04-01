import anthropic
from config import API_KEY, LLM_MODEL, LLM_MAX_TOKENS


client = anthropic.Anthropic(api_key=API_KEY)


def ask_llm(prompt: str) -> str:
    """Send a prompt to the LLM and return the response text."""
    try:
        message = client.messages.create(
            model=LLM_MODEL,
            max_tokens=LLM_MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text
    except Exception as e:
        return f"LLM error: {e}"
