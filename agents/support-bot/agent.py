#!/usr/bin/env python3
"""
AgentBeam Demo Agent — Support Bot
Makes real Anthropic API calls, auto-traced by AgentBeam.
"""
import os
import sys
import time

# Add SDK to path (since it's not pip-installed globally)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'packages', 'sdk-python'))

import agentbeam
from agentbeam.trace import trace

# Initialize AgentBeam — all Anthropic calls will be auto-traced
agentbeam.init(
    api_key="ab_a0cc709bdba5a790a22397adfbfc45223970fb0c90c685ba90086ede7bad7dd4",
    api_url="http://localhost:3001/api/v1",
    agent_name="support-bot-live",
    agent_version="1.0.0",
    flush_interval=2.0,
)

import anthropic

client = anthropic.Anthropic()

SUPPORT_QUERIES = [
    "How do I reset my password? I've tried the forgot password link but nothing happens.",
    "I was charged twice for my subscription this month. Can you help?",
    "What's the difference between your Pro and Enterprise plans?",
    "My API integration keeps timing out. I'm getting 504 errors.",
    "Can I export my data? I need it for a compliance audit.",
]

@trace(name="handle_support_ticket", kind="agent", agent_name="support-bot-live")
def handle_ticket(query: str, ticket_id: int) -> str:
    """Handle a customer support ticket using Claude."""
    print(f"\n{'='*60}")
    print(f"Ticket #{ticket_id}: {query[:60]}...")
    print(f"{'='*60}")

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        system="You are a helpful customer support agent for a SaaS company. Be concise and friendly. Answer in 2-3 sentences max.",
        messages=[{"role": "user", "content": query}],
    )

    answer = response.content[0].text
    print(f"Response: {answer}")
    print(f"Tokens: {response.usage.input_tokens} in / {response.usage.output_tokens} out")
    return answer

def main():
    print("AgentBeam Support Bot — Live Demo")
    print("Making real Anthropic API calls, auto-traced by AgentBeam\n")

    for i, query in enumerate(SUPPORT_QUERIES, 1):
        try:
            handle_ticket(query, i)
        except Exception as e:
            print(f"Error on ticket #{i}: {e}")
        time.sleep(1)  # Small delay between requests

    print("\nFlushing traces to AgentBeam...")
    agentbeam.shutdown()
    time.sleep(2)  # Extra wait for final flush

    print("\nDone! Check your dashboard:")
    print("   http://localhost:3001/traces")
    print("   Look for agent: 'support-bot-live'")

if __name__ == "__main__":
    main()
