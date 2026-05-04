"""
Extension point: register tools (and MCP servers) on the agent.

Add custom tools or MCP connections here so they are available in every
conversation. The function is called once at startup from chatbot/agent.py.

Examples
--------
Custom tool::

    @agent.tool
    def my_tool(context: RunContext[None], arg: str) -> str:
        return f"result for {arg}"

MCP (requires pydantic-ai[mcp] and an MCP server running)::

    from pydantic_ai.mcp import MCPServerStdio
    agent.register_mcp_server(MCPServerStdio("npx", ["-y", "@modelcontextprotocol/server-filesystem", "."]))
"""

from __future__ import annotations

from pydantic_ai import Agent


def register_agent_tools(agent: Agent) -> None:  # type: ignore[type-arg]
    """Register extra tools on *agent*.  No-op by default."""
