# Static assets

The app now uses the official **[Pydantic AI Chat UI](https://github.com/pydantic/ai-chat-ui)** via `agent.to_web()` in `chatbot/app.py`. The UI is loaded from the CDN and cached; no files in this folder are served by default.

The files in this directory (`index.html`, `chat.js`) are the previous **simple vanilla HTML/JS chat UI** that talked to a custom `/chat/` streaming API. They are kept for reference or if you want to implement a minimal UI without the React stack. To use them you would need to restore the previous FastAPI app that served `/`, `/chat/`, and used `chatbot/memory.py` for persistence.
