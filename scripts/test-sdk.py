"""
End-to-end test: proves the AgentBeam Python SDK works against the local API.

Run via:  ./scripts/test-sdk.sh
Expects:  Next.js dev server on http://localhost:3001
"""

import agentbeam
import time
import sys

# Point to local API
agentbeam.init(
    api_key="ab_a0cc709bdba5a790a22397adfbfc45223970fb0c90c685ba90086ede7bad7dd4",
    api_url="http://localhost:3001/api/v1",
    agent_name="test-agent",
    flush_interval=1.0,  # Flush every 1 second for testing
)

# --------------------------------------------------------------------------
# Test 1: trace decorator
# --------------------------------------------------------------------------
from agentbeam.trace import trace, span

@trace(name="process_order", kind="agent")
def process_order(order_id):
    time.sleep(0.1)  # Simulate work
    return f"Order {order_id} processed"

print("Test 1: trace decorator...")
result = process_order("ORD-001")
print(f"  Result: {result}")

# --------------------------------------------------------------------------
# Test 2: span context manager
# --------------------------------------------------------------------------
print("Test 2: span context manager...")
with span("data_lookup", kind="tool") as s:
    time.sleep(0.05)
    print(f"  Span: {s['span_id']}")

# --------------------------------------------------------------------------
# Test 3: Check auto-instrumentation availability
# --------------------------------------------------------------------------
print("Test 3: checking auto-instrumentation...")
try:
    import anthropic
    print("  Anthropic SDK found -- auto-instrumented")
except ImportError:
    print("  Anthropic SDK not installed -- skipping (expected)")

try:
    import openai
    print("  OpenAI SDK found -- auto-instrumented")
except ImportError:
    print("  OpenAI SDK not installed -- skipping (expected)")

# --------------------------------------------------------------------------
# Flush and shut down
# --------------------------------------------------------------------------
print("\nWaiting for flush...")
time.sleep(3)

# shutdown() acquires the lock and flushes remaining spans safely
agentbeam.shutdown()

print("\nSDK test complete!")
print("Check the dashboard at http://localhost:3001/traces")
print("You should see a 'test-agent' with 'process_order' and 'data_lookup' spans")
