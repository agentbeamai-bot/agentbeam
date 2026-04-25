// ---------------------------------------------------------------------------
// ClickHouse HTTP client for AgentBeam
//
// Talks to ClickHouse Cloud over HTTPS using the native HTTP interface.
// All methods are safe to call when ClickHouse is not configured -- they
// return empty results / false so the caller can fall back to Supabase.
// ---------------------------------------------------------------------------

const CLICKHOUSE_HOST = process.env.CLICKHOUSE_HOST;
const CLICKHOUSE_PORT = process.env.CLICKHOUSE_PORT || '8443';
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || 'default';
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD;
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || 'agentbeam';

function getBaseUrl(): string {
  return `https://${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT}`;
}

function getAuthHeader(): string {
  return 'Basic ' + btoa(`${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}`);
}

/**
 * Run a SELECT query and return parsed rows.
 * Appends `FORMAT JSON` automatically.
 */
export async function clickhouseQuery<T = Record<string, unknown>>(
  sql: string,
): Promise<T[]> {
  if (!CLICKHOUSE_HOST || !CLICKHOUSE_PASSWORD) {
    console.warn('[clickhouse] Not configured, skipping query');
    return [];
  }

  const url = `${getBaseUrl()}/?database=${CLICKHOUSE_DATABASE}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
    },
    body: sql + ' FORMAT JSON',
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[clickhouse] query error:', text);
    return [];
  }

  const json = (await res.json()) as { data?: T[] };
  return json.data ?? [];
}

/**
 * Insert rows into a table using JSONEachRow format.
 * Returns true on success, false on failure or when not configured.
 */
export async function clickhouseInsert(
  table: string,
  rows: Record<string, unknown>[],
): Promise<boolean> {
  if (!CLICKHOUSE_HOST || !CLICKHOUSE_PASSWORD || rows.length === 0) {
    return false;
  }

  const encodedQuery = encodeURIComponent(`INSERT INTO ${table} FORMAT JSONEachRow`);
  const url = `${getBaseUrl()}/?database=${CLICKHOUSE_DATABASE}&query=${encodedQuery}`;
  const body = rows.map((r) => JSON.stringify(r)).join('\n');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[clickhouse] insert error:', text);
    return false;
  }

  return true;
}

/**
 * Check whether ClickHouse credentials are present in the environment.
 */
export function isClickHouseConfigured(): boolean {
  return !!(CLICKHOUSE_HOST && CLICKHOUSE_PASSWORD);
}
