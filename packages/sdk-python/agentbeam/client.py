from __future__ import annotations

import atexit
import logging
import threading
import time
from typing import List

import requests

from agentbeam.types import SpanData

logger = logging.getLogger("agentbeam")


class AgentBeamClient:
    """Core client that buffers spans and flushes them to the AgentBeam API."""

    def __init__(
        self,
        api_key: str,
        api_url: str,
        environment: str,
        agent_name: str | None,
        agent_version: str | None,
        flush_interval: float,
        max_batch_size: int,
    ) -> None:
        self.api_key = api_key
        self.api_url = api_url.rstrip("/")
        self.environment = environment
        self.agent_name = agent_name
        self.agent_version = agent_version
        self.flush_interval = flush_interval
        self.max_batch_size = max_batch_size

        self._buffer: List[SpanData] = []
        self._lock = threading.Lock()
        self._shutdown_flag = False

        # Background thread flushes on a timer
        self._flush_thread = threading.Thread(
            target=self._flush_loop, daemon=True, name="agentbeam-flush"
        )
        self._flush_thread.start()

        # Ensure we flush remaining spans when the process exits
        atexit.register(self.shutdown)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def record_span(self, span: SpanData) -> None:
        """Buffer a span. Flushes immediately if the batch is full."""
        with self._lock:
            if self.agent_name and not span.get("agent_name"):
                span["agent_name"] = self.agent_name
            if self.agent_version and not span.get("agent_version"):
                span["agent_version"] = self.agent_version
            if not span.get("environment"):
                span["environment"] = self.environment

            self._buffer.append(span)
            if len(self._buffer) >= self.max_batch_size:
                self._flush()

    def auto_instrument(self) -> None:
        """Monkey-patch supported LLM SDKs so every call is traced."""
        try:
            from agentbeam.instruments.anthropic import patch_anthropic

            patch_anthropic(self)
            logger.debug("Patched Anthropic SDK")
        except ImportError:
            pass

        try:
            from agentbeam.instruments.openai import patch_openai

            patch_openai(self)
            logger.debug("Patched OpenAI SDK")
        except ImportError:
            pass

    def shutdown(self) -> None:
        """Stop the background thread and flush any remaining spans."""
        self._shutdown_flag = True
        with self._lock:
            self._flush()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _flush_loop(self) -> None:
        while not self._shutdown_flag:
            time.sleep(self.flush_interval)
            with self._lock:
                self._flush()

    def _flush(self) -> None:
        """Send buffered spans to the ingest endpoint. Must be called under _lock."""
        if not self._buffer:
            return

        batch = self._buffer[:]
        self._buffer.clear()

        try:
            resp = requests.post(
                f"{self.api_url}/ingest",
                json={
                    "spans": batch,
                    "sdk_version": "0.1.0",
                    "sdk_language": "python",
                },
                headers={
                    "X-AgentBeam-Key": self.api_key,
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
            if resp.status_code != 200:
                logger.warning(
                    "AgentBeam ingest failed (%s): %s", resp.status_code, resp.text
                )
        except Exception as e:
            logger.warning("AgentBeam ingest error: %s", e)
