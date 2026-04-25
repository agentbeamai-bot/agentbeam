from __future__ import annotations

from agentbeam.client import AgentBeamClient
from agentbeam.trace import trace, span

_client: AgentBeamClient | None = None


def init(
    api_key: str,
    api_url: str = "https://agentbeam.dev/api/v1",
    auto_instrument: bool = True,
    environment: str = "production",
    agent_name: str | None = None,
    agent_version: str | None = None,
    flush_interval: float = 5.0,
    max_batch_size: int = 100,
) -> AgentBeamClient:
    """Initialize AgentBeam. Call this once at startup."""
    global _client
    _client = AgentBeamClient(
        api_key=api_key,
        api_url=api_url,
        environment=environment,
        agent_name=agent_name,
        agent_version=agent_version,
        flush_interval=flush_interval,
        max_batch_size=max_batch_size,
    )
    if auto_instrument:
        _client.auto_instrument()
    return _client


def get_client() -> AgentBeamClient:
    """Return the initialized client, or raise if init() hasn't been called."""
    if _client is None:
        raise RuntimeError(
            "AgentBeam not initialized. Call agentbeam.init(api_key='...') first."
        )
    return _client


def shutdown() -> None:
    """Flush remaining spans and stop the background thread."""
    if _client:
        _client.shutdown()


__version__ = "0.1.0"
__all__ = ["init", "get_client", "shutdown", "trace", "span", "__version__"]
