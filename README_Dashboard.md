# Chatbot Template Project Using PydanticAI

A minimal template for building a **custom chatbot** with [Pydantic AI](https://ai.pydantic.dev/) and the official **[Pydantic AI Chat UI](https://github.com/pydantic/ai-chat-ui)** (React + Vercel AI SDK), with clear **extension points** for students.

## Features

- **Pydantic AI agent** – type-safe, model-agnostic agent with configurable system prompt and model.
- **Official Pydantic AI Chat UI** – React-based chat interface ([ai-chat-ui](https://github.com/pydantic/ai-chat-ui)) with streaming, tool visualization, model selector, and dark/light theme. Loaded from CDN by default.
- **Streaming API** – `agent.to_web()` exposes the Vercel AI Data Stream protocol at `/api/chat` and `/api/configure`.
- **Extension points** – config (prompt/model), tools (including MCP), vector store placeholder, and conversational memory (see `chatbot/memory.py` for server-side persistence if you build a custom UI).

## Requirements

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (recommended) or pip
- [ty](https://docs.astral.sh/ty/) for type checking (`uv tool install ty`)
- An API key for your chosen model (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

## Quick start

```bash
# Install uv (if needed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create venv and install dependencies
uv sync

# Set your API key, then run the app
export OPENAI_API_KEY=sk-...
uv run uvicorn chatbot.app:app --reload
```

Open **http://localhost:8000** – the Pydantic AI Chat UI loads from the CDN on first use and is cached locally.

## Backend: OpenAI direct vs LiteLLM

You can send requests either **directly to OpenAI** (or the provider in `DEFAULT_MODEL`) or through a **LiteLLM** server (proxy). Use the flag and env vars below.

### Use OpenAI (or provider) directly

- Set the provider API key, e.g. `OPENAI_API_KEY` for OpenAI.
- Do **not** set `USE_LITELLM` and do not set both `LITELLM_SERVER_URL` and `LITELLM_API_KEY`.
- Example: `export OPENAI_API_KEY=sk-...` then run the app.

### Use LiteLLM

- **LiteLLM server**: Run a [LiteLLM](https://docs.litellm.ai/) proxy/server (e.g. `litellm --port 4000`) and configure it to route models to your providers. The app will send requests to this server.
- **LiteLLM API key**: If your LiteLLM server requires an API key, set `LITELLM_API_KEY`. Some setups use a placeholder; the code uses `litellm-placeholder` when the key is empty.
- **Flag**: Set `USE_LITELLM=1` (or `true`/`yes`) to force LiteLLM mode. Alternatively, if both `LITELLM_SERVER_URL` and `LITELLM_API_KEY` are set, LiteLLM is used automatically.
- **URL**: Set `LITELLM_SERVER_URL` to the server base URL (e.g. `http://localhost:4000`). If your proxy exposes the OpenAI-compatible API under `/v1`, use e.g. `http://localhost:4000/v1`.
- **Model**: Set `LITELLM_MODEL` to the model name passed to LiteLLM (e.g. `openai/gpt-4o-mini`). Default is `openai/gpt-4o-mini`.

Example (LiteLLM proxy on port 4000, no key):

```bash
export USE_LITELLM=1
export LITELLM_SERVER_URL=http://localhost:4000/v1
# LITELLM_API_KEY optional; set if your proxy requires it
uv run uvicorn chatbot.app:app --reload
```

Example (OpenAI direct):

```bash
export OPENAI_API_KEY=sk-...
uv run uvicorn chatbot.app:app --reload
```

You can also add the requirement env variables to a `.env` file.

## Project layout

| Path | Purpose |
|------|--------|
| `src/chatbot/config.py` | **Extension point:** system prompt and model selection |
| `src/chatbot/agent.py` | Pydantic AI agent creation and tool registration |
| `src/chatbot/app.py` | Starlette app via `agent.to_web()` – serves the [ai-chat-ui](https://github.com/pydantic/ai-chat-ui) and `/api` |
| `src/chatbot/memory.py` | **Extension point:** server-side conversational memory (SQLite); used if you add a custom UI or adapter |
| `static/` | Optional: previous simple HTML/JS UI (see `static/README.md`); not used when running `agent.to_web()` |

## Extension points (for students)

### 1. System prompt and model

Edit **`chatbot/config.py`**:

- `DEFAULT_SYSTEM_PROMPT` – instructions that define the assistant’s behaviour.
- `DEFAULT_MODEL` – e.g. `openai:gpt-4o-mini`, `anthropic:claude-sonnet-4`.

You can also load these from environment variables or a config file.

### 2. MCP tools

**`chatbot/extension_points/tools.py`** exposes `register_agent_tools(agent)`. By default it does nothing.

To add tools:

- **Custom tools:** use the `@agent.tool` decorator (see Pydantic AI [tools docs](https://ai.pydantic.dev/tools/)) or register callables inside `register_agent_tools(agent)`.
- **MCP:** install `pydantic-ai[mcp]` and connect to an MCP server (e.g. `MCPServerStdio`), then attach the returned toolset to the agent in `register_agent_tools`.

## Type checking

[ty](https://docs.astral.sh/ty/) (by Astral) is the project's type checker, configured in `pyproject.toml` under `[tool.ty]`.

```bash
# Install once (globally via uv tools)
uv tool install ty

# Check all source files
ty check src/
```

`ty` is also available as a dev dependency via `uv sync --group dev`.

## Optional dependencies

```bash
# Observability (Pydantic Logfire; no-op if not configured)
uv sync --extra logfire

# MCP client support
uv sync --extra mcp
```

## Licence

See [LICENSE](LICENSE).
