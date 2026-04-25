import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_ALERT_TYPES = ['cost_threshold', 'error_rate', 'latency', 'anomaly'] as const;
type AlertType = (typeof VALID_ALERT_TYPES)[number];

async function getAuthenticatedUser(): Promise<
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

/** Two-step auth: look up project org_id, then verify org_members. */
async function verifyProjectAccess(
  userId: string,
  projectId: string,
): Promise<{ ok: true; error?: never } | { ok?: never; error: NextResponse }> {
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
    .eq('user_id', userId)
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

  return { ok: true };
}

// ---------------------------------------------------------------------------
// GET /api/v1/alerts?project_id=...
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (auth.error) return auth.error;
  const { userId } = auth;

  const projectId = request.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json(
      { error: 'project_id is required' },
      { status: 400 },
    );
  }

  const access = await verifyProjectAccess(userId, projectId);
  if (access.error) return access.error;

  const admin = createAdminClient();
  const { data: alerts, error } = await admin
    .from('alerts')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[alerts] list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 },
    );
  }

  return NextResponse.json({ alerts: alerts ?? [] });
}

// ---------------------------------------------------------------------------
// POST /api/v1/alerts — create alert
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (auth.error) return auth.error;
  const { userId } = auth;

  let body: {
    project_id: string;
    name: string;
    type: string;
    config: { threshold: number };
    channels: { email: string };
    enabled?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.project_id || !body.name || !body.type || !body.config || !body.channels) {
    return NextResponse.json(
      { error: 'project_id, name, type, config, and channels are required' },
      { status: 400 },
    );
  }

  if (!VALID_ALERT_TYPES.includes(body.type as AlertType)) {
    return NextResponse.json(
      { error: `Invalid alert type. Must be one of: ${VALID_ALERT_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  if (typeof body.config.threshold !== 'number' || body.config.threshold <= 0) {
    return NextResponse.json(
      { error: 'config.threshold must be a positive number' },
      { status: 400 },
    );
  }

  if (!body.channels.email || typeof body.channels.email !== 'string') {
    return NextResponse.json(
      { error: 'channels.email is required' },
      { status: 400 },
    );
  }

  const access = await verifyProjectAccess(userId, body.project_id);
  if (access.error) return access.error;

  const admin = createAdminClient();
  const { data: alert, error } = await admin
    .from('alerts')
    .insert({
      project_id: body.project_id,
      name: body.name.trim(),
      type: body.type,
      config: body.config,
      channels: body.channels,
      enabled: body.enabled ?? true,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[alerts] create error:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 },
    );
  }

  return NextResponse.json({ alert }, { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/alerts — update alert
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (auth.error) return auth.error;
  const { userId } = auth;

  let body: {
    alert_id: string;
    enabled?: boolean;
    name?: string;
    config?: { threshold: number };
    channels?: { email: string };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.alert_id) {
    return NextResponse.json(
      { error: 'alert_id is required' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Look up the alert to find its project
  const { data: existingAlert } = await admin
    .from('alerts')
    .select('id, project_id')
    .eq('id', body.alert_id)
    .single();

  if (!existingAlert) {
    return NextResponse.json(
      { error: 'Alert not found' },
      { status: 404 },
    );
  }

  const access = await verifyProjectAccess(userId, existingAlert.project_id);
  if (access.error) return access.error;

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.enabled === 'boolean') updates.enabled = body.enabled;
  if (body.name) updates.name = body.name.trim();
  if (body.config) updates.config = body.config;
  if (body.channels) updates.channels = body.channels;

  const { data: alert, error } = await admin
    .from('alerts')
    .update(updates)
    .eq('id', body.alert_id)
    .select('*')
    .single();

  if (error) {
    console.error('[alerts] update error:', error);
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 },
    );
  }

  return NextResponse.json({ alert });
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/alerts — delete alert
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if (auth.error) return auth.error;
  const { userId } = auth;

  let body: { alert_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.alert_id) {
    return NextResponse.json(
      { error: 'alert_id is required' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Look up the alert to find its project
  const { data: existingAlert } = await admin
    .from('alerts')
    .select('id, project_id')
    .eq('id', body.alert_id)
    .single();

  if (!existingAlert) {
    return NextResponse.json(
      { error: 'Alert not found' },
      { status: 404 },
    );
  }

  const access = await verifyProjectAccess(userId, existingAlert.project_id);
  if (access.error) return access.error;

  const { error } = await admin
    .from('alerts')
    .delete()
    .eq('id', body.alert_id);

  if (error) {
    console.error('[alerts] delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete alert' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
