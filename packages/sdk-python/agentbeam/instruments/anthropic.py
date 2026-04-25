from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from agentbeam.client import AgentBeamClient


def patch_anthropic(client: AgentBeamClient) -> None:
    """Monkey-patch the Anthropic SDK to auto-trace all messages.create calls."""
    try:
        import anthropic
        import anthropic.resources
    except ImportError:
        return

    original_create = anthropic.resources.Messages.create

    def patched_create(self: Any, *args: Any, **kwargs: Any) -> Any:
        from agentbeam.types import SpanData

        trace_id = str(uuid.uuid4())
        span_id = str(uuid.uuid4())
        start_time = time.time()
        started_at = datetime.now(timezone.utc).isoformat()

        model = kwargs.get("model", args[0] if args else "unknown")
        messages = kwargs.get("messages", [])

        # Build input preview from the last message
        input_preview = ""
        if messages:
            last_msg = messages[-1]
            content = last_msg.get("content", "")
            if isinstance(content, list):
                text_parts = [
                    p.get("text", "")
                    for p in content
                    if isinstance(p, dict) and p.get("type") == "text"
                ]
                content = " ".join(text_parts)
            input_preview = str(content)[:500]

        try:
            response = original_create(self, *args, **kwargs)
            duration = int((time.time() - start_time) * 1000)

            # Extract token usage
            usage = getattr(response, "usage", None)
            input_tokens = getattr(usage, "input_tokens", 0) if usage else 0
            output_tokens = getattr(usage, "output_tokens", 0) if usage else 0

            # Extract output preview
            output_preview = ""
            content_blocks = getattr(response, "content", [])
            if content_blocks:
                text_blocks = [
                    b.text for b in content_blocks if hasattr(b, "text")
                ]
                output_preview = " ".join(text_blocks)[:500]

            span: SpanData = {
                "trace_id": trace_id,
                "span_id": span_id,
                "span_name": "anthropic.messages.create",
                "span_kind": "llm",
                "status": "ok",
                "model_provider": "anthropic",
                "model_name": model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
                "started_at": started_at,
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "duration_ms": duration,
                "input_preview": input_preview,
                "output_preview": output_preview,
            }
            client.record_span(span)
            return response

        except Exception as e:
            duration = int((time.time() - start_time) * 1000)

            span: SpanData = {  # type: ignore[no-redef]
                "trace_id": trace_id,
                "span_id": span_id,
                "span_name": "anthropic.messages.create",
                "span_kind": "llm",
                "status": "error",
                "model_provider": "anthropic",
                "model_name": model,
                "started_at": started_at,
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "duration_ms": duration,
                "error_message": str(e),
                "error_type": type(e).__name__,
            }
            client.record_span(span)
            raise

    anthropic.resources.Messages.create = patched_create  # type: ignore[assignment]
