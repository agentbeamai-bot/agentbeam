-- Traces table (main telemetry data)
CREATE TABLE traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    trace_id UUID NOT NULL,
    parent_span_id UUID,

    agent_name TEXT,
    agent_version TEXT,
    environment TEXT DEFAULT 'production',

    span_name TEXT NOT NULL,
    span_kind TEXT NOT NULL CHECK (span_kind IN ('agent', 'llm', 'tool', 'chain', 'retrieval', 'custom')),
    status TEXT DEFAULT 'ok' CHECK (status IN ('ok', 'error', 'timeout')),

    model_provider TEXT,
    model_name TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,

    cost_usd DECIMAL(12,8) DEFAULT 0,

    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_ms INTEGER,
    ttft_ms INTEGER,

    input_preview TEXT,
    output_preview TEXT,

    metadata JSONB DEFAULT '{}',
    end_user_id TEXT,
    session_id TEXT,

    error_message TEXT,
    error_type TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_traces_project_time ON traces(project_id, started_at DESC);
CREATE INDEX idx_traces_trace_id ON traces(trace_id);
CREATE INDEX idx_traces_agent ON traces(project_id, agent_name, started_at DESC);
CREATE INDEX idx_traces_status ON traces(project_id, status, started_at DESC);
CREATE INDEX idx_traces_model ON traces(project_id, model_name, started_at DESC);

-- RLS: traces are accessed via API key (service role), not user auth
-- But dashboard queries use user auth
ALTER TABLE traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view traces in their projects" ON traces
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN org_members om ON om.org_id = p.org_id
            WHERE om.user_id = auth.uid()
        )
    );

-- Service role inserts bypass RLS
