import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Pricing table (per 1M tokens in USD)
// ---------------------------------------------------------------------------
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4': { input: 15, output: 75 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-haiku-3.5': { input: 0.8, output: 4 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'deepseek-chat': { input: 0.27, output: 1.1 },
};

function calculateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const normalized = modelName.toLowerCase();
  const entry = Object.entries(MODEL_PRICING).find(([key]) =>
    normalized.includes(key),
  );
  if (!entry) return 0;
  const [, pricing] = entry;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TraceSpan {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  agent_name?: string;
  agent_version?: string;
  environment?: 'production' | 'staging' | 'development';
  span_name: string;
  span_kind: 'agent' | 'llm' | 'tool' | 'chain' | 'retrieval' | 'custom';
  status: 'ok' | 'error' | 'timeout';
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

interface IngestPayload {
  spans: TraceSpan[];
  sdk_version: string;
  sdk_language: 'python' | 'typescript';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_SPAN_KINDS = new Set([
  'agent',
  'llm',
  'tool',
  'chain',
  'retrieval',
  'custom',
]);
const VALID_STATUSES = new Set(['ok', 'error', 'timeout']);
const VALID_ENVIRONMENTS = new Set(['production', 'staging', 'development']);
const MAX_BATCH_SIZE = 500;

function validateSpan(span: TraceSpan): string | null {
  if (!span.trace_id) return 'trace_id is required';
  if (!span.span_id) return 'span_id is required';
  if (!span.span_name) return 'span_name is required';
  if (!span.started_at) return 'started_at is required';
  if (!VALID_SPAN_KINDS.has(span.span_kind))
    return `invalid span_kind: ${span.span_kind}`;
  if (!VALID_STATUSES.has(span.status)) return `invalid status: ${span.status}`;
  if (span.environment && !VALID_ENVIRONMENTS.has(span.environment))
    return `invalid environment: ${span.environment}`;
  return null;
}

async function hashKey(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// POST /api/v1/ingest
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  // 1. Extract API key
  const apiKey = request.headers.get('X-AgentBeam-Key');
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing X-AgentBeam-Key header' },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();

  // 2. Authenticate: hash the key, look up in api_keys
  const keyHash = await hashKey(apiKey);
  const { data: keyRow, error: keyError } = await supabase
    .from('api_keys')
    .select('id, project_id')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .single();

  if (keyError || !keyRow) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  const projectId: string = keyRow.project_id;

  // Fire-and-forget: update last_used_at
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)
    .then(() => {});

  // 3. Parse and validate payload
  let body: IngestPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.spans || !Array.isArray(body.spans) || body.spans.length === 0) {
    return NextResponse.json(
      { error: 'spans array is required and must not be empty' },
      { status: 400 },
    );
  }

  if (body.spans.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` },
      { status: 400 },
    );
  }

  // Validate each span
  for (let i = 0; i < body.spans.length; i++) {
    const err = validateSpan(body.spans[i]);
    if (err) {
      return NextResponse.json(
        { error: `spans[${i}]: ${err}` },
        { status: 400 },
      );
    }
  }

  // 4. Build trace rows and calculate costs
  const traceRows = body.spans.map((span) => {
    const inputTokens = span.input_tokens ?? 0;
    const outputTokens = span.output_tokens ?? 0;
    const costUsd = span.model_name
      ? calculateCost(span.model_name, inputTokens, outputTokens)
      : 0;

    return {
      project_id: projectId,
      trace_id: span.trace_id,
      parent_span_id: span.parent_span_id ?? null,
      agent_name: span.agent_name ?? null,
      agent_version: span.agent_version ?? null,
      environment: span.environment ?? 'production',
      span_name: span.span_name,
      span_kind: span.span_kind,
      status: span.status,
      model_provider: span.model_provider ?? null,
      model_name: span.model_name ?? null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: span.total_tokens ?? inputTokens + outputTokens,
      cost_usd: costUsd,
      started_at: span.started_at,
      ended_at: span.ended_at ?? null,
      duration_ms: span.duration_ms ?? null,
      ttft_ms: span.ttft_ms ?? null,
      input_preview: span.input_preview ?? null,
      output_preview: span.output_preview ?? null,
      metadata: span.metadata ?? {},
      end_user_id: span.end_user_id ?? null,
      session_id: span.session_id ?? null,
      error_message: span.error_message ?? null,
      error_type: span.error_type ?? null,
    };
  });

  // 5. Insert traces
  const { error: insertError } = await supabase
    .from('traces')
    .insert(traceRows);

  if (insertError) {
    console.error('[ingest] trace insert failed:', insertError);
    return NextResponse.json(
      { error: 'Failed to insert traces' },
      { status: 500 },
    );
  }

  // 6. Update cost_rollups -- aggregate per (agent_name, model_name, hour)
  const rollupMap = new Map<
    string,
    {
      agent_name: string;
      model_provider: string;
      model_name: string;
      hour: string;
      total_cost: number;
      total_input_tokens: number;
      total_output_tokens: number;
      request_count: number;
      error_count: number;
      total_latency_ms: number;
    }
  >();

  for (const row of traceRows) {
    // Truncate to hour
    const hourDate = new Date(row.started_at);
    hourDate.setMinutes(0, 0, 0);
    const hourStr = hourDate.toISOString();

    const agentName = row.agent_name ?? '__unknown__';
    const modelName = row.model_name ?? '__none__';
    const modelProvider = row.model_provider ?? '__none__';
    const key = `${agentName}|${modelName}|${hourStr}`;

    const existing = rollupMap.get(key);
    if (existing) {
      existing.total_cost += row.cost_usd;
      existing.total_input_tokens += row.input_tokens;
      existing.total_output_tokens += row.output_tokens;
      existing.request_count += 1;
      existing.error_count += row.status === 'error' ? 1 : 0;
      existing.total_latency_ms += row.duration_ms ?? 0;
    } else {
      rollupMap.set(key, {
        agent_name: agentName,
        model_provider: modelProvider,
        model_name: modelName,
        hour: hourStr,
        total_cost: row.cost_usd,
        total_input_tokens: row.input_tokens,
        total_output_tokens: row.output_tokens,
        request_count: 1,
        error_count: row.status === 'error' ? 1 : 0,
        total_latency_ms: row.duration_ms ?? 0,
      });
    }
  }

  // Upsert each rollup bucket -- using onConflict for the unique constraint
  const rollupPromises = Array.from(rollupMap.values()).map((bucket) => {
    return supabase.from('cost_rollups').upsert(
      {
        project_id: projectId,
        agent_name: bucket.agent_name,
        model_provider: bucket.model_provider,
        model_name: bucket.model_name,
        hour: bucket.hour,
        total_cost: bucket.total_cost,
        total_input_tokens: bucket.total_input_tokens,
        total_output_tokens: bucket.total_output_tokens,
        request_count: bucket.request_count,
        error_count: bucket.error_count,
        avg_latency_ms:
          bucket.request_count > 0
            ? Math.round(bucket.total_latency_ms / bucket.request_count)
            : 0,
      },
      {
        onConflict: 'project_id,agent_name,model_name,hour',
        ignoreDuplicates: false,
      },
    );
  });

  const rollupResults = await Promise.allSettled(rollupPromises);
  const rollupErrors = rollupResults.filter(
    (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error),
  );

  if (rollupErrors.length > 0) {
    // Log but don't fail the request -- traces were already stored
    console.error(
      '[ingest] cost_rollups upsert errors:',
      rollupErrors.length,
    );
  }

  // 7. Return success
  return NextResponse.json({
    accepted: traceRows.length,
    trace_ids: [...new Set(traceRows.map((r) => r.trace_id))],
  });
}
