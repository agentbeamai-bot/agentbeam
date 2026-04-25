# AgentBeam Python SDK

Monitor, debug, and manage the cost of AI agents in production.

## Quick Start (Zero Code Changes)

```bash
pip install agentbeam
```

```bash
AGENTBEAM_API_KEY=ab_your_key_here python -m agentbeam your_script.py
```

That's it. Every Anthropic and OpenAI call is now automatically traced. View traces and costs at https://agentbeam.agentbeamai.workers.dev

## Alternative: One-Line Import

```python
import agentbeam.auto  # Add this line to the top of your entry file
```

Requires `AGENTBEAM_API_KEY` environment variable to be set.

## Get Your API Key

1. Sign up at https://agentbeam.agentbeamai.workers.dev/signup
2. Go to Settings -> Generate New Key
3. Set it as `AGENTBEAM_API_KEY` in your environment
