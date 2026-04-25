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
// GET /api/v1/traces/[traceId]
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ traceId: string }> },
) {
  const { traceId } = await params;

  const auth = await resolveAuth(request);
  if (auth.error) return auth.error;
  const { projectId } = auth;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('traces')
    .select('*')
    .eq('project_id', projectId)
    .eq('trace_id', traceId)
    .order('started_at', { ascending: true });

  if (error) {
    console.error('[traces/traceId] query error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trace spans' },
      { status: 500 },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
  }

  return NextResponse.json({
    trace_id: traceId,
    spans: data,
    span_count: data.length,
  });
}
