"""
Extension points for the chatbot.

- register_agent_tools(agent): add tools (including MCP) to the agent.
- vector_store: placeholder for RAG (see vector_store.py).
- Memory (conversational history) is in chatbot/memory.py.
"""

from chatbot.extension_points.tools import register_agent_tools

__all__ = ["register_agent_tools"]
