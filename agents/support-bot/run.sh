#!/bin/bash
cd "$(dirname "$0")/../.."
source packages/sdk-python/.venv/bin/activate
python agents/support-bot/agent.py
