import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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
// GET /api/v1/costs
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (auth.error) return auth.error;
  const { projectId } = auth;

  const params = request.nextUrl.searchParams;
  const agentName = params.get('agent_name');
  const modelName = params.get('model_name');
  const from = params.get('from');
  const to = params.get('to');
  const groupBy = params.get('group_by') ?? 'hour';

  if (!['agent', 'model', 'hour', 'model_hour', 'agent_model'].includes(groupBy)) {
    return NextResponse.json(
      { error: 'group_by must be one of: agent, model, hour, model_hour, agent_model' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  let query = supabase
    .from('cost_rollups')
    .select('*')
    .eq('project_id', projectId)
    .order('hour', { ascending: false });

  if (agentName) query = query.eq('agent_name', agentName);
  if (modelName) query = query.eq('model_name', modelName);
  if (from) query = query.gte('hour', from);
  if (to) query = query.lte('hour', to);

  const { data, error } = await query;

  if (error) {
    console.error('[costs] query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost data' },
      { status: 500 },
    );
  }

  // Client-side aggregation based on group_by
  // The raw data is already per (agent_name, model_name, hour).
  // We aggregate further depending on the requested grouping.

  if (groupBy === 'model_hour') {
    // Group by (model_name, hour) — for stacked area charts
    const byModelHour = new Map<
      string,
      {
        model_name: string;
        model_provider: string;
        hour: string;
        total_cost: number;
        total_input_tokens: number;
        total_output_tokens: number;
        request_count: number;
        error_count: number;
      }
    >();

    for (const row of data ?? []) {
      const key = `${row.model_name ?? '__none__'}::${row.hour}`;
      const existing = byModelHour.get(key);
      if (existing) {
        existing.total_cost += Number(row.total_cost);
        existing.total_input_tokens += Number(row.total_input_tokens);
        existing.total_output_tokens += Number(row.total_output_tokens);
        existing.request_count += row.request_count;
        existing.error_count += row.error_count;
      } else {
        byModelHour.set(key, {
          model_name: row.model_name ?? '__none__',
          model_provider: row.model_provider ?? '__none__',
          hour: row.hour,
          total_cost: Number(row.total_cost),
          total_input_tokens: Number(row.total_input_tokens),
          total_output_tokens: Number(row.total_output_tokens),
          request_count: row.request_count,
          error_count: row.error_count,
        });
      }
    }

    return NextResponse.json({
      group_by: 'model_hour',
      data: Array.from(byModelHour.values()).sort(
        (a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime(),
      ),
    });
  }

  if (groupBy === 'hour') {
    // Group by hour across all agents/models
    const byHour = new Map<
      string,
      {
        hour: string;
        total_cost: number;
        total_input_tokens: number;
        total_output_tokens: number;
        request_count: number;
        error_count: number;
      }
    >();

    for (const row of data ?? []) {
      const existing = byHour.get(row.hour);
      if (existing) {
        existing.total_cost += Number(row.total_cost);
        existing.total_input_tokens += Number(row.total_input_tokens);
        existing.total_output_tokens += Number(row.total_output_tokens);
        existing.request_count += row.request_count;
        existing.error_count += row.error_count;
      } else {
        byHour.set(row.hour, {
          hour: row.hour,
          total_cost: Number(row.total_cost),
          total_input_tokens: Number(row.total_input_tokens),
          total_output_tokens: Number(row.total_output_tokens),
          request_count: row.request_count,
          error_count: row.error_count,
        });
      }
    }

    return NextResponse.json({
      group_by: 'hour',
      data: Array.from(byHour.values()).sort(
        (a, b) => new Date(b.hour).getTime() - new Date(a.hour).getTime(),
      ),
    });
  }

  if (groupBy === 'agent_model') {
    // Group by (agent_name, model_name) — for segmented bar charts
    const byAgentModel = new Map<
      string,
      {
        agent_name: string;
        model_name: string;
        total_cost: number;
        total_input_tokens: number;
        total_output_tokens: number;
        request_count: number;
        error_count: number;
      }
    >();

    for (const row of data ?? []) {
      const agent = row.agent_name ?? '__unknown__';
      const model = row.model_name ?? '__none__';
      const key = `${agent}::${model}`;
      const existing = byAgentModel.get(key);
      if (existing) {
        existing.total_cost += Number(row.total_cost);
        existing.total_input_tokens += Number(row.total_input_tokens);
        existing.total_output_tokens += Number(row.total_output_tokens);
        existing.request_count += row.request_count;
        existing.error_count += row.error_count;
      } else {
        byAgentModel.set(key, {
          agent_name: agent,
          model_name: model,
          total_cost: Number(row.total_cost),
          total_input_tokens: Number(row.total_input_tokens),
          total_output_tokens: Number(row.total_output_tokens),
          request_count: row.request_count,
          error_count: row.error_count,
        });
      }
    }

    return NextResponse.json({
      group_by: 'agent_model',
      data: Array.from(byAgentModel.values()).sort(
        (a, b) => b.total_cost - a.total_cost,
      ),
    });
  }

  if (groupBy === 'agent') {
    const byAgent = new Map<
      string,
      {
        agent_name: string;
        total_cost: number;
        total_input_tokens: number;
        total_output_tokens: number;
        request_count: number;
        error_count: number;
      }
    >();

    for (const row of data ?? []) {
      const key = row.agent_name ?? '__unknown__';
      const existing = byAgent.get(key);
      if (existing) {
        existing.total_cost += Number(row.total_cost);
        existing.total_input_tokens += Number(row.total_input_tokens);
        existing.total_output_tokens += Number(row.total_output_tokens);
        existing.request_count += row.request_count;
        existing.error_count += row.error_count;
      } else {
        byAgent.set(key, {
          agent_name: key,
          total_cost: Number(row.total_cost),
          total_input_tokens: Number(row.total_input_tokens),
          total_output_tokens: Number(row.total_output_tokens),
          request_count: row.request_count,
          error_count: row.error_count,
        });
      }
    }

    return NextResponse.json({
      group_by: 'agent',
      data: Array.from(byAgent.values()).sort(
        (a, b) => b.total_cost - a.total_cost,
      ),
    });
  }

  // group_by === 'model'
  const byModel = new Map<
    string,
    {
      model_name: string;
      model_provider: string;
      total_cost: number;
      total_input_tokens: number;
      total_output_tokens: number;
      request_count: number;
      error_count: number;
    }
  >();

  for (const row of data ?? []) {
    const key = row.model_name ?? '__none__';
    const existing = byModel.get(key);
    if (existing) {
      existing.total_cost += Number(row.total_cost);
      existing.total_input_tokens += Number(row.total_input_tokens);
      existing.total_output_tokens += Number(row.total_output_tokens);
      existing.request_count += row.request_count;
      existing.error_count += row.error_count;
    } else {
      byModel.set(key, {
        model_name: key,
        model_provider: row.model_provider ?? '__none__',
        total_cost: Number(row.total_cost),
        total_input_tokens: Number(row.total_input_tokens),
        total_output_tokens: Number(row.total_output_tokens),
        request_count: row.request_count,
        error_count: row.error_count,
      });
    }
  }

  return NextResponse.json({
    group_by: 'model',
    data: Array.from(byModel.values()).sort(
      (a, b) => b.total_cost - a.total_cost,
    ),
  });
}
