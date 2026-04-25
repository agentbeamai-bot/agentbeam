-- Alert configurations
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cost_threshold', 'error_rate', 'latency', 'anomaly')),
    config JSONB NOT NULL,
    channels JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Alert event history
CREATE TABLE alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    triggered_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    details JSONB
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts in their projects" ON alerts
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN org_members om ON om.org_id = p.org_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage alerts" ON alerts
    FOR ALL USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN org_members om ON om.org_id = p.org_id
            WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can view alert events" ON alert_events
    FOR SELECT USING (
        alert_id IN (
            SELECT a.id FROM alerts a
            JOIN projects p ON p.id = a.project_id
            JOIN org_members om ON om.org_id = p.org_id
            WHERE om.user_id = auth.uid()
        )
    );
