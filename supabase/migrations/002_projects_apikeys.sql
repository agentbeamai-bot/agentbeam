-- Projects within organizations
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, slug)
);

-- API Keys for SDK authentication
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    name TEXT NOT NULL,
    environment TEXT DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'development')),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS: users can see projects in their orgs
CREATE POLICY "Users can view their projects" ON projects
    FOR SELECT USING (
        org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Admins can manage projects" ON projects
    FOR ALL USING (
        org_id IN (
            SELECT org_id FROM org_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can view API keys in their projects" ON api_keys
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN org_members om ON om.org_id = p.org_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage API keys" ON api_keys
    FOR ALL USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN org_members om ON om.org_id = p.org_id
            WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
        )
    );
