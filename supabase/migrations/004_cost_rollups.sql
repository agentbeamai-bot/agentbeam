-- Pre-aggregated cost rollups for fast dashboard queries
CREATE TABLE cost_rollups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    agent_name TEXT,
    model_provider TEXT,
    model_name TEXT,
    hour TIMESTAMPTZ NOT NULL,

    total_cost DECIMAL(12,6) DEFAULT 0,
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    request_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    p95_latency_ms INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, agent_name, model_name, hour)
);

CREATE INDEX idx_cost_rollups_project_time ON cost_rollups(project_id, hour DESC);
CREATE INDEX idx_cost_rollups_agent ON cost_rollups(project_id, agent_name, hour DESC);

ALTER TABLE cost_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cost rollups in their projects" ON cost_rollups
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN org_members om ON om.org_id = p.org_id
            WHERE om.user_id = auth.uid()
        )
    );
