"""
Run a Python script with AgentBeam auto-instrumentation.

Usage:
    AGENTBEAM_API_KEY=ab_xxx python -m agentbeam your_script.py [args...]

Requires AGENTBEAM_API_KEY environment variable.
"""
from __future__ import annotations

import os
import sys

# ---------------------------------------------------------------------------
# Validate environment
# ---------------------------------------------------------------------------

api_key = os.environ.get("AGENTBEAM_API_KEY")
if not api_key:
    print(
        "Error: AGENTBEAM_API_KEY environment variable is required.\n"
        "\n"
        "Usage:\n"
        "  AGENTBEAM_API_KEY=ab_xxx python -m agentbeam your_script.py\n",
        file=sys.stderr,
    )
    sys.exit(1)

if len(sys.argv) < 2:
    print(
        "Usage: python -m agentbeam your_script.py [args...]\n"
        "\n"
        "Runs your script with AgentBeam auto-instrumentation enabled.\n"
        "Requires AGENTBEAM_API_KEY environment variable.",
        file=sys.stderr,
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Initialize AgentBeam (patches Anthropic/OpenAI prototypes)
# ---------------------------------------------------------------------------

import agentbeam  # noqa: E402

agentbeam.init(
    api_key=api_key,
    api_url=os.environ.get(
        "AGENTBEAM_API_URL",
        "https://agentbeam.agentbeamai.workers.dev/api/v1",
    ),
    agent_name=os.environ.get("AGENTBEAM_AGENT_NAME", "default"),
    agent_version=os.environ.get("AGENTBEAM_AGENT_VERSION"),
    environment=os.environ.get("AGENTBEAM_ENVIRONMENT", "production"),
    auto_instrument=True,
)

print("[AgentBeam] Auto-instrumentation active", file=sys.stderr)

# ---------------------------------------------------------------------------
# Run the target script
# ---------------------------------------------------------------------------

import runpy  # noqa: E402

target = sys.argv[1]
sys.argv = sys.argv[1:]  # Shift args so the target sees its own argv

try:
    runpy.run_path(target, run_name="__main__")
finally:
    agentbeam.shutdown()
