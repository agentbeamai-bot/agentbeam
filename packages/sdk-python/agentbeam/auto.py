"""
Zero-code auto-instrumentation for AgentBeam.

Usage (pick one):

    # Import at the top of your entry point (one line, that's it):
    import agentbeam.auto

    # Or run your script via the agentbeam module:
    AGENTBEAM_API_KEY=ab_xxx python -m agentbeam your_script.py

    # Or set PYTHONSTARTUP for any Python process:
    AGENTBEAM_API_KEY=ab_xxx PYTHONSTARTUP=$(python -c "import agentbeam.auto; print(agentbeam.auto.__file__)") python your_script.py

Environment variables:
    AGENTBEAM_API_KEY       (required) - your AgentBeam API key
    AGENTBEAM_API_URL       (optional) - API endpoint, defaults to https://agentbeam.agentbeamai.workers.dev/api/v1
    AGENTBEAM_AGENT_NAME    (optional) - agent name, defaults to 'default'
    AGENTBEAM_AGENT_VERSION (optional) - agent version string
    AGENTBEAM_ENVIRONMENT   (optional) - environment tag, defaults to 'production'
    AGENTBEAM_DEBUG         (optional) - set to '1' to enable debug logging
"""
from __future__ import annotations

import logging
import os

_api_key = os.environ.get("AGENTBEAM_API_KEY")
_debug = os.environ.get("AGENTBEAM_DEBUG") == "1"

if _debug:
    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger("agentbeam")
    logger.setLevel(logging.DEBUG)

if not _api_key:
    if _debug:
        logging.getLogger("agentbeam").warning(
            "AGENTBEAM_API_KEY not set - auto-instrumentation disabled."
        )
else:
    import agentbeam

    _client = agentbeam.init(
        api_key=_api_key,
        api_url=os.environ.get(
            "AGENTBEAM_API_URL",
            "https://agentbeam.agentbeamai.workers.dev/api/v1",
        ),
        agent_name=os.environ.get("AGENTBEAM_AGENT_NAME", "default"),
        agent_version=os.environ.get("AGENTBEAM_AGENT_VERSION"),
        environment=os.environ.get("AGENTBEAM_ENVIRONMENT", "production"),
        auto_instrument=True,
    )

    import atexit

    atexit.register(agentbeam.shutdown)

    print("[AgentBeam] Auto-instrumentation active")
