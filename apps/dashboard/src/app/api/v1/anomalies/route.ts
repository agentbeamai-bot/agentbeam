import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Anomaly {
  agent_name: string;
  metric: 'cost' | 'error_rate' | 'latency';
  current_value: number;
  baseline_mean: number;
  baseline_stddev: number;
  severity: 'warning' | 'critical';
}

interface RollupRow {
  agent_name: string | null;
  hour: string;
  total_cost: number;
  request_count: number;
  error_count: number;
  avg_latency_ms: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function hashKey(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function resolveAuth(
  request: NextRequest,
): Promise<
  | { projectId: string; error?: never }
  | { projectId?: never; error: NextResponse }
> {
  const apiKey = request.headers.get('X-AgentBeam-Key');

  if (apiKey) {
    const supabase = createAdminClient();
    const keyHash = await hashKey(apiKey);
    const { data: keyRow, error } = await supabase
      .from('api_keys')
      .select('project_id')
      .eq('key_hash', keyHash)
      .is('revoked_at', null)
      .single();

    if (error || !keyRow) {
      return {
        error: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
      };
    }
    return { projectId: keyRow.project_id };
  }

  // Session auth
  const projectId = request.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return {
      error: NextResponse.json(
        { error: 'project_id query parameter is required' },
        { status: 400 },
      ),
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // Two-step auth: project -> org_members
  const admin = createAdminClient();
  const { data: project } = await admin
    .from('projects')
    .select('org_id')
    .eq('id', projectId)
    .single();

  if (!project) {
    return {
      error: NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 403 },
      ),
    };
  }

  const { data: membership } = await admin
    .from('org_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('org_id', project.org_id)
    .single();

  if (!membership) {
    return {
      error: NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 403 },
      ),
    };
  }

  return { projectId };
}

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((s, v) => s + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Core anomaly detection logic (exported for reuse in alert evaluation)
// ---------------------------------------------------------------------------

export async function detectAnomalies(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  stddevThreshold: number = 2,
): Promise<Anomaly[]> {
  const now = new Date();

  // Current hour boundary
  const currentHourStart = new Date(now);
  currentHourStart.setUTCMinutes(0, 0, 0);

  // 7 days ago for baseline (excluding current hour)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Fetch all rollups for the last 7 days
  const { data: rollups, error } = await supabase
    .from('cost_rollups')
    .select(
      'agent_name, hour, total_cost, request_count, error_count, avg_latency_ms',
    )
    .eq('project_id', projectId)
    .gte('hour', sevenDaysAgo.toISOString())
    .order('hour', { ascending: true });

  if (error || !rollups || rollups.length === 0) {
    return [];
  }

  const typedRollups = rollups as RollupRow[];

  // Group rollups by agent
  const agentRollups = new Map<string, RollupRow[]>();
  for (const row of typedRollups) {
    const agentName = row.agent_name ?? '__unknown__';
    const existing = agentRollups.get(agentName);
    if (existing) {
      existing.push(row);
    } else {
      agentRollups.set(agentName, [row]);
    }
  }

  const currentHourISO = currentHourStart.toISOString();
  const anomalies: Anomaly[] = [];

  for (const [agentName, rows] of agentRollups) {
    // Separate current hour from baseline
    const currentRows = rows.filter((r) => r.hour === currentHourISO);
    const baselineRows = rows.filter((r) => r.hour !== currentHourISO);

    // Need at least a few baseline data points for meaningful statistics
    if (baselineRows.length < 3) continue;

    // Aggregate current hour values (may have multiple model entries)
    const currentCost = currentRows.reduce(
      (s, r) => s + Number(r.total_cost),
      0,
    );
    const currentRequests = currentRows.reduce(
      (s, r) => s + r.request_count,
      0,
    );
    const currentErrors = currentRows.reduce(
      (s, r) => s + r.error_count,
      0,
    );
    const currentErrorRate =
      currentRequests > 0 ? currentErrors / currentRequests : 0;

    // Weighted average latency for current hour
    const currentLatency =
      currentRequests > 0
        ? currentRows.reduce(
            (s, r) => s + r.avg_latency_ms * r.request_count,
            0,
          ) / currentRequests
        : 0;

    // If no activity in the current hour, skip this agent
    if (currentRequests === 0 && currentCost === 0) continue;

    // Build baseline per-hour aggregates (since a single hour may have
    // multiple rows per model)
    const baselineByHour = new Map<
      string,
      { cost: number; requests: number; errors: number; latencySum: number }
    >();
    for (const row of baselineRows) {
      const existing = baselineByHour.get(row.hour);
      if (existing) {
        existing.cost += Number(row.total_cost);
        existing.requests += row.request_count;
        existing.errors += row.error_count;
        existing.latencySum += row.avg_latency_ms * row.request_count;
      } else {
        baselineByHour.set(row.hour, {
          cost: Number(row.total_cost),
          requests: row.request_count,
          errors: row.error_count,
          latencySum: row.avg_latency_ms * row.request_count,
        });
      }
    }

    const hourlyAggs = Array.from(baselineByHour.values());

    // --- Cost anomaly ---
    const costValues = hourlyAggs.map((h) => h.cost);
    const costMean = mean(costValues);
    const costStd = stddev(costValues, costMean);

    if (costStd > 0 && currentCost > costMean + stddevThreshold * costStd) {
      const deviations = (currentCost - costMean) / costStd;
      anomalies.push({
        agent_name: agentName,
        metric: 'cost',
        current_value: Math.round(currentCost * 1_000_000) / 1_000_000,
        baseline_mean: Math.round(costMean * 1_000_000) / 1_000_000,
        baseline_stddev: Math.round(costStd * 1_000_000) / 1_000_000,
        severity: deviations > 3 ? 'critical' : 'warning',
      });
    }

    // --- Error rate anomaly ---
    const errorRateValues = hourlyAggs.map((h) =>
      h.requests > 0 ? h.errors / h.requests : 0,
    );
    const erMean = mean(errorRateValues);
    const erStd = stddev(errorRateValues, erMean);

    if (erStd > 0 && currentErrorRate > erMean + stddevThreshold * erStd) {
      const deviations = (currentErrorRate - erMean) / erStd;
      anomalies.push({
        agent_name: agentName,
        metric: 'error_rate',
        current_value: Math.round(currentErrorRate * 10_000) / 10_000,
        baseline_mean: Math.round(erMean * 10_000) / 10_000,
        baseline_stddev: Math.round(erStd * 10_000) / 10_000,
        severity: deviations > 3 ? 'critical' : 'warning',
      });
    }

    // --- Latency anomaly ---
    const latencyValues = hourlyAggs.map((h) =>
      h.requests > 0 ? h.latencySum / h.requests : 0,
    );
    const latMean = mean(latencyValues);
    const latStd = stddev(latencyValues, latMean);

    if (latStd > 0 && currentLatency > latMean + stddevThreshold * latStd) {
      const deviations = (currentLatency - latMean) / latStd;
      anomalies.push({
        agent_name: agentName,
        metric: 'latency',
        current_value: Math.round(currentLatency),
        baseline_mean: Math.round(latMean),
        baseline_stddev: Math.round(latStd),
        severity: deviations > 3 ? 'critical' : 'warning',
      });
    }
  }

  return anomalies;
}

// ---------------------------------------------------------------------------
// GET /api/v1/anomalies
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (auth.error) return auth.error;
  const { projectId } = auth;

  const supabase = createAdminClient();

  try {
    const anomalies = await detectAnomalies(supabase, projectId);

    return NextResponse.json({ anomalies });
  } catch (err) {
    console.error('[anomalies] detection error:', err);
    return NextResponse.json(
      { error: 'Failed to detect anomalies' },
      { status: 500 },
    );
  }
}
