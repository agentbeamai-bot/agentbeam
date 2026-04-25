// Span kinds that AgentBeam tracks
export type SpanKind = 'agent' | 'llm' | 'tool' | 'chain' | 'retrieval' | 'custom';

// Status of a span
export type SpanStatus = 'ok' | 'error' | 'timeout';

// Supported model providers
export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'mistral' | 'meta' | 'deepseek' | 'other';

// Environment types
export type Environment = 'production' | 'staging' | 'development';

// Plan types
export type Plan = 'free' | 'pro' | 'enterprise';

// Org member roles
export type OrgRole = 'owner' | 'admin' | 'member';

// Alert types
export type AlertType = 'cost_threshold' | 'error_rate' | 'latency' | 'anomaly';

// A single trace span sent from the SDK
export interface TraceSpan {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;

  agent_name?: string;
  agent_version?: string;
  environment?: Environment;

  span_name: string;
  span_kind: SpanKind;
  status: SpanStatus;

  model_provider?: ModelProvider;
  model_name?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;

  started_at: string; // ISO 8601
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

// Batch of spans sent from SDK to API
export interface IngestPayload {
  spans: TraceSpan[];
  sdk_version: string;
  sdk_language: 'python' | 'typescript';
}

// Cost rollup for dashboard
export interface CostRollup {
  project_id: string;
  agent_name: string;
  model_provider: string;
  model_name: string;
  hour: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  request_count: number;
  error_count: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
}

// Dashboard overview stats
export interface OverviewStats {
  total_cost: number;
  total_requests: number;
  error_rate: number;
  avg_latency_ms: number;
  cost_change_pct: number;
  requests_change_pct: number;
  error_rate_change_pct: number;
  latency_change_ms: number;
}

// Agent summary for live view
export interface AgentSummary {
  agent_name: string;
  status: 'running' | 'idle' | 'error';
  model_name: string;
  last_active_at: string;
  total_cost_today: number;
  request_count_today: number;
  error_count_today: number;
}
