import { randomUUID } from 'node:crypto';
import { AgentBeamClient } from './client';
import { SpanData, SpanKind, SpanStatus } from './types';

export interface StartSpanOptions {
  kind?: SpanKind;
  parentSpanId?: string;
  traceId?: string;
  metadata?: Record<string, string>;
  agentName?: string;
  endUserId?: string;
  sessionId?: string;
}

export class SpanBuilder {
  private _span: SpanData;
  private _ended = false;

  constructor(
    private _client: AgentBeamClient,
    name: string,
    kind: SpanKind,
    options?: Omit<StartSpanOptions, 'kind'>,
  ) {
    this._span = {
      trace_id: options?.traceId ?? randomUUID(),
      span_id: randomUUID(),
      parent_span_id: options?.parentSpanId,
      span_name: name,
      span_kind: kind,
      status: 'ok',
      started_at: new Date().toISOString(),
      metadata: options?.metadata,
      agent_name: options?.agentName,
      end_user_id: options?.endUserId,
      session_id: options?.sessionId,
    };
  }

  /** Get the trace ID for correlating child spans. */
  get traceId(): string {
    return this._span.trace_id;
  }

  /** Get the span ID for use as a parent in child spans. */
  get spanId(): string {
    return this._span.span_id;
  }

  setMetadata(key: string, value: string): this {
    if (!this._span.metadata) this._span.metadata = {};
    this._span.metadata[key] = value;
    return this;
  }

  setAgentName(name: string): this {
    this._span.agent_name = name;
    return this;
  }

  setModel(provider: string, model: string): this {
    this._span.model_provider = provider;
    this._span.model_name = model;
    return this;
  }

  setTokenUsage(input: number, output: number): this {
    this._span.input_tokens = input;
    this._span.output_tokens = output;
    this._span.total_tokens = input + output;
    return this;
  }

  setInput(preview: string): this {
    this._span.input_preview = preview.slice(0, 4096);
    return this;
  }

  setOutput(preview: string): this {
    this._span.output_preview = preview.slice(0, 4096);
    return this;
  }

  setError(message: string, type?: string): this {
    this._span.status = 'error';
    this._span.error_message = message;
    this._span.error_type = type;
    return this;
  }

  end(status?: SpanStatus): void {
    if (this._ended) return;
    this._ended = true;

    const now = new Date();
    this._span.ended_at = now.toISOString();
    this._span.duration_ms =
      now.getTime() - new Date(this._span.started_at).getTime();

    if (status) this._span.status = status;

    this._client.addSpan(this._span);
  }
}

/**
 * Start a new span for manual tracing.
 *
 * ```ts
 * const span = startSpan(client, 'my-tool-call', { kind: 'tool' });
 * try {
 *   const result = await doWork();
 *   span.setOutput(JSON.stringify(result));
 *   span.end();
 * } catch (err) {
 *   span.setError(err.message);
 *   span.end('error');
 *   throw err;
 * }
 * ```
 */
export function startSpan(
  client: AgentBeamClient,
  name: string,
  options?: StartSpanOptions,
): SpanBuilder {
  return new SpanBuilder(client, name, options?.kind ?? 'custom', options);
}
