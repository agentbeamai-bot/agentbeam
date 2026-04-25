import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// GET /api/v1/agents
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  // --- Auth (two-step: project -> org_members) ---
  const projectId = request.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json(
      { error: 'project_id query parameter is required' },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Step 1: look up project's org_id
  const { data: project } = await admin
    .from('projects')
    .select('org_id')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found or access denied' },
      { status: 403 },
    );
  }

  // Step 2: verify user is a member of that org
  const { data: membership } = await admin
    .from('org_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('org_id', project.org_id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: 'Project not found or access denied' },
      { status: 403 },
    );
  }

  // --- Query distinct agents with aggregated stats ---
  // Supabase JS client doesn't support GROUP BY natively, so we use an RPC
  // or raw query. Since we're using the admin client (service role), we can
  // query directly and aggregate in JS, or use a raw SQL call.
  //
  // Approach: fetch all traces for the project grouped by agent_name using
  // a Postgres function call. Fallback: fetch with supabase and aggregate.

  const { data: traces, error } = await admin
    .from('traces')
    .select('agent_name, status, cost_usd, duration_ms, model_name, started_at')
    .eq('project_id', projectId)
    .not('agent_name', 'is', null)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('[agents] query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 },
    );
  }

  // Aggregate per agent_name
  const agentMap = new Map<
    string,
    {
      agent_name: string;
      total_traces: number;
      total_cost: number;
      error_count: number;
      total_duration: number;
      duration_count: number;
      last_active: string;
      model_counts: Map<string, number>;
    }
  >();

  for (const row of traces ?? []) {
    const name = row.agent_name as string;
    if (!name) continue;

    let agg = agentMap.get(name);
    if (!agg) {
      agg = {
        agent_name: name,
        total_traces: 0,
        total_cost: 0,
        error_count: 0,
        total_duration: 0,
        duration_count: 0,
        last_active: row.started_at,
        model_counts: new Map(),
      };
      agentMap.set(name, agg);
    }

    agg.total_traces += 1;
    agg.total_cost += Number(row.cost_usd) || 0;
    if (row.status === 'error' || row.status === 'timeout') {
      agg.error_count += 1;
    }
    if (row.duration_ms != null) {
      agg.total_duration += Number(row.duration_ms);
      agg.duration_count += 1;
    }
    // last_active is already the most recent due to ORDER BY
    if (row.model_name) {
      const prev = agg.model_counts.get(row.model_name) ?? 0;
      agg.model_counts.set(row.model_name, prev + 1);
    }
  }

  // Build response
  const agents = Array.from(agentMap.values()).map((agg) => {
    // Find the most used model
    let topModel: string | null = null;
    let topModelCount = 0;
    for (const [model, count] of agg.model_counts) {
      if (count > topModelCount) {
        topModel = model;
        topModelCount = count;
      }
    }

    return {
      agent_name: agg.agent_name,
      total_traces: agg.total_traces,
      total_cost: agg.total_cost,
      error_count: agg.error_count,
      error_rate:
        agg.total_traces > 0 ? agg.error_count / agg.total_traces : 0,
      avg_duration_ms:
        agg.duration_count > 0
          ? Math.round(agg.total_duration / agg.duration_count)
          : null,
      last_active: agg.last_active,
      top_model: topModel,
    };
  });

  // Sort by last_active descending
  agents.sort(
    (a, b) =>
      new Date(b.last_active).getTime() - new Date(a.last_active).getTime(),
  );

  return NextResponse.json({ agents });
}
