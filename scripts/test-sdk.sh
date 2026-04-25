#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source packages/sdk-python/.venv/bin/activate
python scripts/test-sdk.py
