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

/** Resolve project_id from either session auth or API key. */
async function resolveAuth(
  request: NextRequest,
): Promise<
  | { projectId: string; error?: never }
  | { projectId?: never; error: NextResponse }
> {
  const apiKey = request.headers.get('X-AgentBeam-Key');

  if (apiKey) {
    // API key auth
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

  // Session auth -- project_id must come from query param
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

  // Verify user has access to this project via org membership
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from('org_members')
    .select('id, projects!inner(id)')
    .eq('user_id', user.id)
    .eq('projects.id', projectId)
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
// GET /api/v1/traces
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (auth.error) return auth.error;
  const { projectId } = auth;

  const params = request.nextUrl.searchParams;
  const agentName = params.get('agent_name');
  const status = params.get('status');
  const modelName = params.get('model_name');
  const from = params.get('from');
  const to = params.get('to');
  const limit = Math.min(
    Math.max(parseInt(params.get('limit') ?? '50', 10) || 50, 1),
    200,
  );
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0);

  const supabase = createAdminClient();

  let query = supabase
    .from('traces')
    .select('*', { count: 'exact' })
    .eq('project_id', projectId)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (agentName) query = query.eq('agent_name', agentName);
  if (status) query = query.eq('status', status);
  if (modelName) query = query.eq('model_name', modelName);
  if (from) query = query.gte('started_at', from);
  if (to) query = query.lte('started_at', to);

  const { data, error, count } = await query;

  if (error) {
    console.error('[traces] query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch traces' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    traces: data,
    total: count,
    limit,
    offset,
  });
}
