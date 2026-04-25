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
  // Projects endpoint uses session auth only (no API key auth)
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
// GET /api/v1/projects -- list user's projects
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const { userId } = auth;

  const admin = createAdminClient();

  // Get all orgs the user belongs to, then all projects in those orgs
  const { data: memberships, error: memError } = await admin
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId);

  if (memError) {
    console.error('[projects] membership query error:', memError);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 },
    );
  }

  const orgIds = (memberships ?? []).map((m) => m.org_id);
  if (orgIds.length === 0) {
    return NextResponse.json({ projects: [] });
  }

  const { data: projects, error: projError } = await admin
    .from('projects')
    .select('*, organizations(name, slug)')
    .in('org_id', orgIds)
    .order('created_at', { ascending: false });

  if (projError) {
    console.error('[projects] query error:', projError);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 },
    );
  }

  return NextResponse.json({ projects: projects ?? [] });
}

// ---------------------------------------------------------------------------
// POST /api/v1/projects -- create project + API key
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return auth.error;
  const { userId } = auth;

  let body: { name: string; org_id?: string; environment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json(
      { error: 'name is required' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  let orgId = body.org_id;

  // If no org_id provided, auto-create an organization for the user
  if (!orgId) {
    // Get user email for the org name
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userEmail = user?.email ?? 'unknown';
    const orgName = `${userEmail}'s Workspace`;
    const orgSlug = userEmail
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if user already has an org (edge case: they have one but didn't send it)
    const { data: existingMemberships } = await admin
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .limit(1);

    if (existingMemberships && existingMemberships.length > 0) {
      orgId = existingMemberships[0].org_id;
    } else {
      // Create new org
      const { data: newOrg, error: orgError } = await admin
        .from('organizations')
        .insert({ name: orgName, slug: orgSlug })
        .select()
        .single();

      if (orgError) {
        console.error('[projects] org create error:', orgError);
        return NextResponse.json(
          { error: 'Failed to create organization' },
          { status: 500 },
        );
      }

      // Link user as owner
      const { error: memberError } = await admin
        .from('org_members')
        .insert({ org_id: newOrg.id, user_id: userId, role: 'owner' });

      if (memberError) {
        console.error('[projects] org_member create error:', memberError);
        return NextResponse.json(
          { error: 'Failed to create organization membership' },
          { status: 500 },
        );
      }

      orgId = newOrg.id;
    }
  }

  // Verify user is admin/owner in the org
  const { data: membership } = await admin
    .from('org_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'You must be an admin or owner to create projects' },
      { status: 403 },
    );
  }

  // Generate slug from name
  const slug = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Create project
  const { data: project, error: projError } = await admin
    .from('projects')
    .insert({
      org_id: orgId,
      name: body.name.trim(),
      slug,
    })
    .select()
    .single();

  if (projError) {
    if (projError.code === '23505') {
      return NextResponse.json(
        { error: 'A project with this name already exists in the organization' },
        { status: 409 },
      );
    }
    console.error('[projects] create error:', projError);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 },
    );
  }

  // Generate API key
  const rawKey = generateApiKey();
  const keyHash = await hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 10); // "ab_xxxxxxx"

  const { error: keyError } = await admin.from('api_keys').insert({
    project_id: project.id,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    name: `${body.name.trim()} key`,
    environment: body.environment || 'production',
  });

  if (keyError) {
    console.error('[projects] api_key create error:', keyError);
    // Project was created but key failed -- still return project info
    return NextResponse.json(
      {
        project,
        api_key: null,
        warning: 'Project created but API key generation failed. Create one manually.',
      },
      { status: 201 },
    );
  }

  return NextResponse.json(
    {
      project,
      api_key: rawKey,
      key_prefix: keyPrefix,
      message: 'Save this API key now. It will not be shown again.',
    },
    { status: 201 },
  );
}
