from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from agentbeam.client import AgentBeamClient


def patch_openai(client: AgentBeamClient) -> None:
    """Monkey-patch the OpenAI SDK to auto-trace all chat.completions.create calls."""
    try:
        import openai
        import openai.resources.chat
    except ImportError:
        return

    original_create = openai.resources.chat.Completions.create

    def patched_create(self: Any, *args: Any, **kwargs: Any) -> Any:
        from agentbeam.types import SpanData

        trace_id = str(uuid.uuid4())
        span_id = str(uuid.uuid4())
        start_time = time.time()
        started_at = datetime.now(timezone.utc).isoformat()

        model = kwargs.get("model", "unknown")
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
                    if isinstance(p, dict)
                ]
                content = " ".join(text_parts)
            input_preview = str(content)[:500]

        try:
            response = original_create(self, *args, **kwargs)
            duration = int((time.time() - start_time) * 1000)

            # Extract token usage
            usage = getattr(response, "usage", None)
            input_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
            output_tokens = (
                getattr(usage, "completion_tokens", 0) if usage else 0
            )

            # Extract output preview
            output_preview = ""
            choices = getattr(response, "choices", [])
            if choices:
                msg = getattr(choices[0], "message", None)
                if msg:
                    output_preview = (getattr(msg, "content", "") or "")[:500]

            span: SpanData = {
                "trace_id": trace_id,
                "span_id": span_id,
                "span_name": "openai.chat.completions.create",
                "span_kind": "llm",
                "status": "ok",
                "model_provider": "openai",
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
                "span_name": "openai.chat.completions.create",
                "span_kind": "llm",
                "status": "error",
                "model_provider": "openai",
                "model_name": model,
                "started_at": started_at,
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "duration_ms": duration,
                "error_message": str(e),
                "error_type": type(e).__name__,
            }
            client.record_span(span)
            raise

    openai.resources.chat.Completions.create = patched_create  # type: ignore[assignment]
