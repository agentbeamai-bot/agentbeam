#!/usr/bin/env node

/**
 * AgentBeam ClickHouse setup script.
 *
 * Creates the `agentbeam` database, the `traces` table (MergeTree),
 * the `cost_rollups_hourly` table (SummingMergeTree), and the
 * materialized view that auto-aggregates cost data.
 *
 * Reads credentials from the root .env file.
 *
 * Usage:
 *   node scripts/clickhouse-setup.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const envPath = join(root, '.env');

// ---------------------------------------------------------------------------
// Parse .env (zero deps, same approach as migrate.mjs)
// ---------------------------------------------------------------------------
function loadEnv(filePath) {
  const vars = {};
  let content;
  try {
    content = readFileSync(decodeURIComponent(filePath), 'utf-8');
  } catch {
    console.error(`Could not read ${filePath}`);
    process.exit(1);
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

// ---------------------------------------------------------------------------
// ClickHouse HTTP client
// ---------------------------------------------------------------------------
const env = loadEnv(envPath);

const CH_HOST = env.CLICKHOUSE_HOST;
const CH_PORT = env.CLICKHOUSE_PORT || '8443';
const CH_USER = env.CLICKHOUSE_USER || 'default';
const CH_PASSWORD = env.CLICKHOUSE_PASSWORD;

if (!CH_HOST || !CH_PASSWORD) {
  console.error(
    'CLICKHOUSE_HOST and CLICKHOUSE_PASSWORD must be set in .env',
  );
  process.exit(1);
}

const BASE_URL = `https://${CH_HOST}:${CH_PORT}`;
const AUTH_HEADER =
  'Basic ' + Buffer.from(`${CH_USER}:${CH_PASSWORD}`).toString('base64');

async function execSQL(sql, description) {
  console.log(`\n--- ${description} ---`);
  console.log(sql.trim().slice(0, 120) + (sql.length > 120 ? '...' : ''));

  const url = `${BASE_URL}/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: AUTH_HEADER,
    },
    body: sql,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`FAILED: ${text}`);
    process.exit(1);
  }

  const body = await res.text();
  if (body.trim()) console.log(body.trim());
  console.log('OK');
}

// ---------------------------------------------------------------------------
// SQL statements
// ---------------------------------------------------------------------------
const SQL_CREATE_DATABASE = `CREATE DATABASE IF NOT EXISTS agentbeam`;

const SQL_CREATE_TRACES = `
CREATE TABLE IF NOT EXISTS agentbeam.traces (
    id UUID DEFAULT generateUUIDv4(),
    project_id UUID,
    trace_id UUID,
    parent_span_id Nullable(UUID),
    agent_name Nullable(String),
    agent_version Nullable(String),
    environment LowCardinality(String) DEFAULT 'production',
    span_name String,
    span_kind LowCardinality(String),
    status LowCardinality(String) DEFAULT 'ok',
    model_provider LowCardinality(Nullable(String)),
    model_name LowCardinality(Nullable(String)),
    input_tokens UInt32 DEFAULT 0,
    output_tokens UInt32 DEFAULT 0,
    total_tokens UInt32 DEFAULT 0,
    cost_usd Decimal64(8) DEFAULT 0,
    started_at DateTime64(3),
    ended_at Nullable(DateTime64(3)),
    duration_ms Nullable(UInt32),
    ttft_ms Nullable(UInt32),
    input_preview Nullable(String),
    output_preview Nullable(String),
    metadata String DEFAULT '{}',
    end_user_id Nullable(String),
    session_id Nullable(String),
    error_message Nullable(String),
    error_type Nullable(String),
    created_at DateTime64(3) DEFAULT now64(3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(started_at)
ORDER BY (project_id, started_at, trace_id)
TTL toDateTime(started_at) + INTERVAL 90 DAY
`;

const SQL_CREATE_COST_ROLLUPS = `
CREATE TABLE IF NOT EXISTS agentbeam.cost_rollups_hourly (
    project_id UUID,
    agent_name String,
    model_provider String,
    model_name String,
    hour DateTime,
    total_cost Decimal64(6),
    total_input_tokens UInt64,
    total_output_tokens UInt64,
    request_count UInt32,
    error_count UInt32,
    sum_latency_ms UInt64,
    max_latency_ms UInt32
) ENGINE = SummingMergeTree()
ORDER BY (project_id, agent_name, model_name, hour)
`;

const SQL_CREATE_MV = `
CREATE MATERIALIZED VIEW IF NOT EXISTS agentbeam.cost_rollups_mv
TO agentbeam.cost_rollups_hourly
AS SELECT
    project_id,
    coalesce(agent_name, '__none__') as agent_name,
    coalesce(model_provider, 'unknown') as model_provider,
    coalesce(model_name, 'unknown') as model_name,
    toStartOfHour(started_at) as hour,
    sum(cost_usd) as total_cost,
    sum(input_tokens) as total_input_tokens,
    sum(output_tokens) as total_output_tokens,
    count() as request_count,
    countIf(status = 'error') as error_count,
    sum(duration_ms) as sum_latency_ms,
    max(duration_ms) as max_latency_ms
FROM agentbeam.traces
GROUP BY project_id, agent_name, model_provider, model_name, hour
`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`ClickHouse: ${CH_HOST}:${CH_PORT} (user: ${CH_USER})`);

  await execSQL(SQL_CREATE_DATABASE, 'Creating database');
  await execSQL(SQL_CREATE_TRACES, 'Creating traces table');
  await execSQL(SQL_CREATE_COST_ROLLUPS, 'Creating cost_rollups_hourly table');
  await execSQL(SQL_CREATE_MV, 'Creating cost_rollups_mv materialized view');

  console.log('\nClickHouse setup complete.');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
