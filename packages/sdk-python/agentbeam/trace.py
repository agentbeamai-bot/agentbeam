from __future__ import annotations

import functools
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Generator, Optional, TypeVar

from agentbeam.types import SpanData

F = TypeVar("F", bound=Callable[..., Any])


def trace(
    func: F | None = None,
    *,
    name: str | None = None,
    kind: str = "agent",
    agent_name: str | None = None,
    metadata: Dict[str, object] | None = None,
) -> Any:
    """Decorator to trace a function as a span.

    Can be used with or without arguments::

        @trace
        def my_func(): ...

        @trace(name="custom_name", kind="tool")
        def my_func(): ...
    """

    def decorator(fn: F) -> F:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            from agentbeam import get_client

            client = get_client()

            span_name = name or fn.__name__
            trace_id = str(uuid.uuid4())
            span_id = str(uuid.uuid4())
            start_time = time.time()
            started_at = datetime.now(timezone.utc).isoformat()

            try:
                result = fn(*args, **kwargs)
                duration = int((time.time() - start_time) * 1000)

                span_data: SpanData = {
                    "trace_id": trace_id,
                    "span_id": span_id,
                    "span_name": span_name,
                    "span_kind": kind,  # type: ignore[typeddict-item]
                    "status": "ok",
                    "started_at": started_at,
                    "ended_at": datetime.now(timezone.utc).isoformat(),
                    "duration_ms": duration,
                    "agent_name": agent_name,
                    "metadata": metadata or {},
                }
                client.record_span(span_data)
                return result
            except Exception as e:
                duration = int((time.time() - start_time) * 1000)

                span_data: SpanData = {  # type: ignore[no-redef]
                    "trace_id": trace_id,
                    "span_id": span_id,
                    "span_name": span_name,
                    "span_kind": kind,  # type: ignore[typeddict-item]
                    "status": "error",
                    "started_at": started_at,
                    "ended_at": datetime.now(timezone.utc).isoformat(),
                    "duration_ms": duration,
                    "error_message": str(e),
                    "error_type": type(e).__name__,
                    "agent_name": agent_name,
                    "metadata": metadata or {},
                }
                client.record_span(span_data)
                raise

        return wrapper  # type: ignore[return-value]

    if func is not None:
        return decorator(func)
    return decorator


@contextmanager
def span(
    name: str,
    kind: str = "custom",
    agent_name: str | None = None,
    metadata: Dict[str, object] | None = None,
) -> Generator[Dict[str, str], None, None]:
    """Context manager for creating manual spans.

    Usage::

        with span("my_operation") as s:
            print(s["trace_id"])
            do_work()
    """
    from agentbeam import get_client

    client = get_client()

    trace_id = str(uuid.uuid4())
    span_id = str(uuid.uuid4())
    start_time = time.time()
    started_at = datetime.now(timezone.utc).isoformat()

    try:
        yield {"trace_id": trace_id, "span_id": span_id}
        duration = int((time.time() - start_time) * 1000)

        span_data: SpanData = {
            "trace_id": trace_id,
            "span_id": span_id,
            "span_name": name,
            "span_kind": kind,  # type: ignore[typeddict-item]
            "status": "ok",
            "started_at": started_at,
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "duration_ms": duration,
            "agent_name": agent_name,
            "metadata": metadata or {},
        }
        client.record_span(span_data)
    except Exception as e:
        duration = int((time.time() - start_time) * 1000)

        span_data: SpanData = {  # type: ignore[no-redef]
            "trace_id": trace_id,
            "span_id": span_id,
            "span_name": name,
            "span_kind": kind,  # type: ignore[typeddict-item]
            "status": "error",
            "started_at": started_at,
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "duration_ms": duration,
            "error_message": str(e),
            "error_type": type(e).__name__,
            "agent_name": agent_name,
            "metadata": metadata or {},
        }
        client.record_span(span_data)
        raise
