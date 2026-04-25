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

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `ab_${hex}`;
}

async function getAuthenticatedUser(
  request: NextRequest,
): Promise<
  | { userId: string; error?: never }
  | { userId?: never; error: NextResponse }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { userId: user.id };
}

// ---------------------------------------------------------------------------
// GET /api/v1/api-keys?project_id=...
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const { userId } = auth;

  const projectId = request.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json(
      { error: 'project_id is required' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Verify user has access to this project via org membership
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

  const { data: membership } = await admin
    .from('org_members')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', project.org_id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: 'Project not found or access denied' },
      { status: 403 },
    );
  }

  const { data: keys, error } = await admin
    .from('api_keys')
    .select('id, name, key_prefix, environment, created_at, last_used_at, revoked_at')
    .eq('project_id', projectId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api-keys] list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 },
    );
  }

  return NextResponse.json({ api_keys: keys ?? [] });
}

// ---------------------------------------------------------------------------
// POST /api/v1/api-keys — generate a new API key
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const { userId } = auth;

  let body: { project_id: string; name?: string; environment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.project_id) {
    return NextResponse.json(
      { error: 'project_id is required' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Verify user is admin/owner in the org that owns this project
  const { data: project } = await admin
    .from('projects')
    .select('id, org_id')
    .eq('id', body.project_id)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 },
    );
  }

  const { data: membership } = await admin
    .from('org_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', project.org_id)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'You must be an admin or owner to create API keys' },
      { status: 403 },
    );
  }

  const rawKey = generateApiKey();
  const keyHash = await hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 10);

  const { data: keyRow, error: keyError } = await admin
    .from('api_keys')
    .insert({
      project_id: body.project_id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: body.name?.trim() || 'Untitled',
      environment: body.environment ?? 'production',
    })
    .select('id, name, key_prefix, environment, created_at')
    .single();

  if (keyError) {
    console.error('[api-keys] create error:', keyError);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      api_key: rawKey,
      key: keyRow,
      message: 'Save this API key now. It will not be shown again.',
    },
    { status: 201 },
  );
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/api-keys — revoke a key
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const { userId } = auth;

  let body: { key_id: string; action: 'revoke' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.key_id || body.action !== 'revoke') {
    return NextResponse.json(
      { error: 'key_id and action="revoke" are required' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Get the key's project to find the org
  const { data: keyRow } = await admin
    .from('api_keys')
    .select('id, project_id')
    .eq('id', body.key_id)
    .single();

  if (!keyRow) {
    return NextResponse.json(
      { error: 'API key not found' },
      { status: 404 },
    );
  }

  const { data: project } = await admin
    .from('projects')
    .select('org_id')
    .eq('id', keyRow.project_id)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 },
    );
  }

  const orgId = project.org_id;

  // Verify user is admin/owner
  const { data: membership } = await admin
    .from('org_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'You must be an admin or owner to revoke API keys' },
      { status: 403 },
    );
  }

  const { error: updateError } = await admin
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', body.key_id);

  if (updateError) {
    console.error('[api-keys] revoke error:', updateError);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
