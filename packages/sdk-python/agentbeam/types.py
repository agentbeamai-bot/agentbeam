from __future__ import annotations

from typing import Dict, List, Literal, Optional, TypedDict


class SpanData(TypedDict, total=False):
    """A single span representing one unit of work in a trace."""

    trace_id: str
    span_id: str
    parent_span_id: Optional[str]
    agent_name: Optional[str]
    agent_version: Optional[str]
    environment: Optional[str]
    span_name: str
    span_kind: Literal["agent", "llm", "tool", "chain", "retrieval", "custom"]
    status: Literal["ok", "error", "timeout"]
    model_provider: Optional[str]
    model_name: Optional[str]
    input_tokens: Optional[int]
    output_tokens: Optional[int]
    total_tokens: Optional[int]
    started_at: str
    ended_at: Optional[str]
    duration_ms: Optional[int]
    ttft_ms: Optional[int]
    input_preview: Optional[str]
    output_preview: Optional[str]
    metadata: Optional[Dict[str, object]]
    end_user_id: Optional[str]
    session_id: Optional[str]
    error_message: Optional[str]
    error_type: Optional[str]
