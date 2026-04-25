export interface AgentBeamConfig {
  apiKey: string;
  apiUrl?: string;
  environment?: 'production' | 'staging' | 'development';
  agentName?: string;
  agentVersion?: string;
  flushInterval?: number; // ms, default 5000
  maxBatchSize?: number; // default 100
}

export type SpanKind = 'agent' | 'llm' | 'tool' | 'chain' | 'retrieval' | 'custom';
export type SpanStatus = 'ok' | 'error' | 'timeout';

export interface SpanData {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  agent_name?: string;
  agent_version?: string;
  environment?: string;
  span_name: string;
  span_kind: SpanKind;
  status: SpanStatus;
  model_provider?: string;
  model_name?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  ttft_ms?: number;
  input_preview?: string;
  output_preview?: string;
  metadata?: Record<string, string>;
  end_user_id?: string;
  session_id?: string;
  error_message?: string;
  error_type?: string;
}

export interface IngestPayload {
  spans: SpanData[];
  sdk_version: string;
  sdk_language: 'typescript';
}
