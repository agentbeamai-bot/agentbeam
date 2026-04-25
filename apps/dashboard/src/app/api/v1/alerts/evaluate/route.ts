import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyTriggeredAlerts } from '@/lib/alert-notifier';
import { detectAnomalies } from '@/app/api/v1/anomalies/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

async function hashKey(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Evaluation logic per alert type
// ---------------------------------------------------------------------------

interface AlertRow {
  id: string;
  name: string;
  type: string;
  config: { threshold: number };
  last_triggered_at: string | null;
}

interface TriggerResult {
  alert_id: string;
  name: string;
  type: string;
  details: Record<string, unknown>;
}

async function evaluateCostThreshold(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  alert: AlertRow,
): Promise<TriggerResult | null> {
  // Start of today (UTC)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: rollups } = await supabase
    .from('cost_rollups')
    .select('total_cost')
    .eq('project_id', projectId)
    .gte('hour', todayStart.toISOString());

  if (!rollups || rollups.length === 0) return null;

  const totalCost = rollups.reduce(
    (sum, r) => sum + parseFloat(String(r.total_cost)),
    0,
  );

  if (totalCost > alert.config.threshold) {
    return {
      alert_id: alert.id,
      name: alert.name,
      type: alert.type,
      details: {
        threshold: alert.config.threshold,
        actual: Math.round(totalCost * 100) / 100,
        message: `Daily cost $${totalCost.toFixed(2)} exceeded threshold $${alert.config.threshold.toFixed(2)}`,
      },
    };
  }

  return null;
}

async function evaluateErrorRate(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  alert: AlertRow,
): Promise<TriggerResult | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: totalCount } = await supabase
    .from('traces')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .gte('started_at', oneHourAgo);

  if (!totalCount || totalCount === 0) return null;

  const { count: errorCount } = await supabase
    .from('traces')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('status', 'error')
    .gte('started_at', oneHourAgo);

  const errorRate = ((errorCount ?? 0) / totalCount) * 100;

  if (errorRate > alert.config.threshold) {
    return {
      alert_id: alert.id,
      name: alert.name,
      type: alert.type,
      details: {
        threshold: alert.config.threshold,
        actual: Math.round(errorRate * 100) / 100,
        error_count: errorCount ?? 0,
        total_count: totalCount,
        message: `Error rate ${errorRate.toFixed(1)}% exceeded threshold ${alert.config.threshold}%`,
      },
    };
  }

  return null;
}

async function evaluateLatency(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  alert: AlertRow,
): Promise<TriggerResult | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: traces } = await supabase
    .from('traces')
    .select('duration_ms')
    .eq('project_id', projectId)
    .gte('started_at', oneHourAgo)
    .not('duration_ms', 'is', null);

  if (!traces || traces.length === 0) return null;

  const totalLatency = traces.reduce(
    (sum, t) => sum + (t.duration_ms ?? 0),
    0,
  );
  const avgLatency = totalLatency / traces.length;

  if (avgLatency > alert.config.threshold) {
    return {
      alert_id: alert.id,
      name: alert.name,
      type: alert.type,
      details: {
        threshold: alert.config.threshold,
        actual: Math.round(avgLatency),
        trace_count: traces.length,
        message: `Avg latency ${Math.round(avgLatency)}ms exceeded threshold ${alert.config.threshold}ms`,
      },
    };
  }

  return null;
}

async function evaluateAnomaly(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  alert: AlertRow,
): Promise<TriggerResult | null> {
  const threshold = alert.config.threshold ?? 2;
  const anomalies = await detectAnomalies(supabase, projectId, threshold);

  // Only trigger on critical anomalies
  const critical = anomalies.filter((a) => a.severity === 'critical');

  if (critical.length === 0) return null;

  const summaries = critical.map(
    (a) =>
      `${a.agent_name}: ${a.metric} is ${a.current_value} (baseline ${a.baseline_mean} +/- ${a.baseline_stddev})`,
  );

  return {
    alert_id: alert.id,
    name: alert.name,
    type: alert.type,
    details: {
      threshold,
      anomaly_count: critical.length,
      anomalies: critical,
      message: `${critical.length} critical anomal${critical.length === 1 ? 'y' : 'ies'} detected: ${summaries.join('; ')}`,
    },
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/alerts/evaluate
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  // 1. Authenticate via API key — same pattern as ingest route
  const apiKey = request.headers.get('X-AgentBeam-Key');
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing X-AgentBeam-Key header' },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();

  const keyHash = await hashKey(apiKey);
  const { data: keyRow, error: keyError } = await supabase
    .from('api_keys')
    .select('id, project_id')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .single();

  if (keyError || !keyRow) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  // 2. Parse body and validate project_id matches the key
  let body: { project_id: string };
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

  if (body.project_id !== keyRow.project_id) {
    return NextResponse.json(
      { error: 'API key does not match project_id' },
      { status: 403 },
    );
  }

  const projectId = body.project_id;

  // 3. Fetch all enabled alerts for this project
  const { data: alerts, error: alertsError } = await supabase
    .from('alerts')
    .select('id, name, type, config, channels, last_triggered_at')
    .eq('project_id', projectId)
    .eq('enabled', true);

  if (alertsError) {
    console.error('[alerts/evaluate] fetch alerts error:', alertsError);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 },
    );
  }

  if (!alerts || alerts.length === 0) {
    return NextResponse.json({ evaluated: 0, triggered: [] });
  }

  // 4. Evaluate each alert
  const triggered: TriggerResult[] = [];
  const now = Date.now();

  for (const alert of alerts) {
    // Cooldown check: don't re-trigger within 30 minutes
    if (alert.last_triggered_at) {
      const lastTriggered = new Date(alert.last_triggered_at).getTime();
      if (now - lastTriggered < COOLDOWN_MS) {
        continue;
      }
    }

    let result: TriggerResult | null = null;

    try {
      switch (alert.type) {
        case 'cost_threshold':
          result = await evaluateCostThreshold(supabase, projectId, alert);
          break;
        case 'error_rate':
          result = await evaluateErrorRate(supabase, projectId, alert);
          break;
        case 'latency':
          result = await evaluateLatency(supabase, projectId, alert);
          break;
        case 'anomaly':
          result = await evaluateAnomaly(supabase, projectId, alert);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(
        `[alerts/evaluate] error evaluating alert ${alert.id}:`,
        err,
      );
      continue;
    }

    if (result) {
      triggered.push(result);
    }
  }

  // 5. Record triggered events and update last_triggered_at
  if (triggered.length > 0) {
    const eventRows = triggered.map((t) => ({
      alert_id: t.alert_id,
      triggered_at: new Date().toISOString(),
      details: t.details,
    }));

    const { error: insertError } = await supabase
      .from('alert_events')
      .insert(eventRows);

    if (insertError) {
      console.error('[alerts/evaluate] insert events error:', insertError);
    }

    // Update last_triggered_at on each triggered alert
    const updatePromises = triggered.map((t) =>
      supabase
        .from('alerts')
        .update({
          last_triggered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', t.alert_id),
    );

    await Promise.allSettled(updatePromises);

    // Send email notifications (fire-and-forget)
    const alertsWithChannels = triggered.map((t) => {
      const alertRow = alerts.find((a) => a.id === t.alert_id);
      return {
        alert_id: t.alert_id,
        name: t.name,
        type: t.type,
        channels: (alertRow?.channels as { email?: string }) ?? {},
        currentValue: (t.details as { actual?: number }).actual ?? 0,
        threshold: (t.details as { threshold?: number }).threshold ?? 0,
      };
    });

    notifyTriggeredAlerts(alertsWithChannels, request.nextUrl.origin).catch(
      (err) => console.error('[alerts/evaluate] notify error:', err),
    );
  }

  return NextResponse.json({
    evaluated: alerts.length,
    triggered: triggered.map((t) => ({
      alert_id: t.alert_id,
      name: t.name,
      type: t.type,
      details: t.details,
    })),
  });
}
