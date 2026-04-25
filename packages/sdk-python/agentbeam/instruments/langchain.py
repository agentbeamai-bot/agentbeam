from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from agentbeam.client import AgentBeamClient


def patch_langchain(client: AgentBeamClient) -> None:
    """Patch LangChain to auto-trace. Coming soon."""
    pass
