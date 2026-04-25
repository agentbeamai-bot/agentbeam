'use client';

import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface OverviewStats {
  totalCost: number;
  totalRequests: number;
  errorRate: number;
  avgLatency: number;
  costChange: number;
  requestsChange: number;
  errorRateChange: number;
  latencyChange: number;
}

export interface CostTimeseriesPoint {
  hour: string;
  total_cost: number;
  request_count: number;
}

export interface AgentSummary {
  agent_name: string;
  total_cost: number;
  request_count: number;
  error_count: number;
  last_active: string;
  last_model: string;
  is_active: boolean;
}

interface CostApiRow {
  hour: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  request_count: number;
  error_count: number;
}

interface AgentApiRow {
  agent_name: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  request_count: number;
  error_count: number;
}

interface Trace {
  agent_name: string | null;
  model_name: string | null;
  started_at: string;
  cost_usd: number;
  duration_ms: number | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return url.toString();
}

function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------
async function fetchOverviewStats(
  projectId: string,
): Promise<OverviewStats> {
  const currentFrom = hoursAgo(24);
  const previousFrom = hoursAgo(48);
  const previousTo = hoursAgo(24);

  const [currentRes, previousRes] = await Promise.all([
    fetch(
      buildUrl('/api/v1/costs', {
        project_id: projectId,
        group_by: 'hour',
        from: currentFrom,
      }),
    ),
    fetch(
      buildUrl('/api/v1/costs', {
        project_id: projectId,
        group_by: 'hour',
        from: previousFrom,
        to: previousTo,
      }),
    ),
  ]);

  if (!currentRes.ok || !previousRes.ok) {
    throw new Error('Failed to fetch overview stats');
  }

  const current = await currentRes.json();
  const previous = await previousRes.json();

  const currentData: CostApiRow[] = current.data ?? [];
  const previousData: CostApiRow[] = previous.data ?? [];

  const sum = (rows: CostApiRow[]) => ({
    cost: rows.reduce((s, r) => s + r.total_cost, 0),
    requests: rows.reduce((s, r) => s + r.request_count, 0),
    errors: rows.reduce((s, r) => s + r.error_count, 0),
  });

  const cur = sum(currentData);
  const prev = sum(previousData);

  const errorRate = cur.requests > 0 ? (cur.errors / cur.requests) * 100 : 0;
  const prevErrorRate =
    prev.requests > 0 ? (prev.errors / prev.requests) * 100 : 0;

  // Fetch traces for latency data
  const tracesRes = await fetch(
    buildUrl('/api/v1/traces', {
      project_id: projectId,
      from: currentFrom,
      limit: '200',
    }),
  );
  const tracesData = await tracesRes.json();
  const traces: Trace[] = tracesData.traces ?? [];

  const latencies = traces
    .map((t) => t.duration_ms)
    .filter((d): d is number => d != null && d > 0);
  const avgLatency =
    latencies.length > 0
      ? latencies.reduce((s, l) => s + l, 0) / latencies.length
      : 0;

  // Previous period latency (rough estimate)
  const prevTracesRes = await fetch(
    buildUrl('/api/v1/traces', {
      project_id: projectId,
      from: previousFrom,
      to: previousTo,
      limit: '200',
    }),
  );
  const prevTracesData = await prevTracesRes.json();
  const prevTraces: Trace[] = prevTracesData.traces ?? [];
  const prevLatencies = prevTraces
    .map((t) => t.duration_ms)
    .filter((d): d is number => d != null && d > 0);
  const prevAvgLatency =
    prevLatencies.length > 0
      ? prevLatencies.reduce((s, l) => s + l, 0) / prevLatencies.length
      : 0;

  const pctChange = (cur: number, prev: number): number => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };

  return {
    totalCost: cur.cost,
    totalRequests: cur.requests,
    errorRate,
    avgLatency,
    costChange: pctChange(cur.cost, prev.cost),
    requestsChange: pctChange(cur.requests, prev.requests),
    errorRateChange: pctChange(errorRate, prevErrorRate),
    latencyChange: pctChange(avgLatency, prevAvgLatency),
  };
}

async function fetchCostTimeseries(
  projectId: string,
): Promise<CostTimeseriesPoint[]> {
  const res = await fetch(
    buildUrl('/api/v1/costs', {
      project_id: projectId,
      group_by: 'hour',
      from: hoursAgo(7 * 24),
    }),
  );

  if (!res.ok) throw new Error('Failed to fetch cost timeseries');

  const json = await res.json();
  const data: CostApiRow[] = json.data ?? [];

  return data
    .map((row) => ({
      hour: row.hour,
      total_cost: row.total_cost,
      request_count: row.request_count,
    }))
    .sort((a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime());
}

async function fetchAgentSummaries(
  projectId: string,
): Promise<AgentSummary[]> {
  const [agentRes, tracesRes] = await Promise.all([
    fetch(
      buildUrl('/api/v1/costs', {
        project_id: projectId,
        group_by: 'agent',
        from: hoursAgo(24),
      }),
    ),
    fetch(
      buildUrl('/api/v1/traces', {
        project_id: projectId,
        limit: '200',
        from: hoursAgo(24),
      }),
    ),
  ]);

  if (!agentRes.ok) throw new Error('Failed to fetch agent summaries');

  const agentJson = await agentRes.json();
  const agentData: AgentApiRow[] = agentJson.data ?? [];
  const tracesJson = await tracesRes.json();
  const traces: Trace[] = tracesJson.traces ?? [];

  const fiveMinAgo = Date.now() - 5 * 60 * 1000;

  // Build a lookup from traces for last activity and model
  const agentMeta = new Map<
    string,
    { lastActive: string; lastModel: string }
  >();
  for (const t of traces) {
    const name = t.agent_name ?? '__unknown__';
    if (!agentMeta.has(name)) {
      agentMeta.set(name, {
        lastActive: t.started_at,
        lastModel: t.model_name ?? '-',
      });
    }
  }

  return agentData.map((a) => {
    const meta = agentMeta.get(a.agent_name);
    const lastActive = meta?.lastActive ?? '';
    const isActive = lastActive
      ? new Date(lastActive).getTime() > fiveMinAgo
      : false;

    return {
      agent_name: a.agent_name,
      total_cost: a.total_cost,
      request_count: a.request_count,
      error_count: a.error_count,
      last_active: lastActive,
      last_model: meta?.lastModel ?? '-',
      is_active: isActive,
    };
  });
}

// ---------------------------------------------------------------------------
// Projects fetcher
// ---------------------------------------------------------------------------
export interface Project {
  id: string;
  name: string;
  slug: string;
  org_id: string;
  created_at: string;
  organizations?: { name: string; slug: string };
}

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/v1/projects');
  if (!res.ok) throw new Error('Failed to fetch projects');
  const json = await res.json();
  return json.projects ?? [];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
}

export function useDashboardData(projectId: string | null) {
  const statsQuery = useQuery<OverviewStats>({
    queryKey: ['dashboard', 'stats', projectId],
    queryFn: () => fetchOverviewStats(projectId!),
    enabled: !!projectId,
    refetchInterval: 60_000,
  });

  const costTimeseriesQuery = useQuery<CostTimeseriesPoint[]>({
    queryKey: ['dashboard', 'cost-timeseries', projectId],
    queryFn: () => fetchCostTimeseries(projectId!),
    enabled: !!projectId,
    refetchInterval: 60_000,
  });

  const agentSummariesQuery = useQuery<AgentSummary[]>({
    queryKey: ['dashboard', 'agent-summaries', projectId],
    queryFn: () => fetchAgentSummaries(projectId!),
    enabled: !!projectId,
    refetchInterval: 30_000,
  });

  return {
    stats: statsQuery.data ?? null,
    costTimeseries: costTimeseriesQuery.data ?? [],
    agentSummaries: agentSummariesQuery.data ?? [],
    isLoading:
      statsQuery.isLoading ||
      costTimeseriesQuery.isLoading ||
      agentSummariesQuery.isLoading,
    error:
      statsQuery.error ?? costTimeseriesQuery.error ?? agentSummariesQuery.error,
  };
}
