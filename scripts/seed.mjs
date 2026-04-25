#!/usr/bin/env node

// ---------------------------------------------------------------------------
// AgentBeam seed script — zero npm dependencies
// Creates org, project, API key, then ingests 200+ realistic trace spans.
// Usage: node scripts/seed.mjs
// ---------------------------------------------------------------------------

import { readFileSync } from "fs";
import { createHash, randomBytes, randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// 1. Read .env
// ---------------------------------------------------------------------------
const ENV_PATH = decodeURIComponent(new URL("../.env", import.meta.url).pathname);
let envText;
try {
  envText = readFileSync(ENV_PATH, "utf-8");
} catch {
  console.error(`ERROR: Cannot read ${ENV_PATH}`);
  process.exit(1);
}

const env = {};
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  env[key] = val;
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env",
  );
  process.exit(1);
}

console.log(`Supabase URL: ${SUPABASE_URL}`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sbHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function sbPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: sbHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${table} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function sbGet(table, query = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: sbHeaders,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${table} failed (${res.status}): ${text}`);
  }
  return res.json();
}

function hashApiKey(raw) {
  return createHash("sha256").update(raw, "utf-8").digest("hex");
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// 2. Create organization
// ---------------------------------------------------------------------------
console.log("\n--- Creating organization ---");
const [org] = await sbPost("organizations", {
  name: "My Workspace",
  slug: "my-workspace",
});
console.log(`  org_id: ${org.id}`);

// ---------------------------------------------------------------------------
// 3. Get first auth user
// ---------------------------------------------------------------------------
console.log("\n--- Fetching first auth user ---");
const usersRes = await fetch(
  `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`,
  {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  },
);
if (!usersRes.ok) {
  const t = await usersRes.text();
  console.error(`Failed to fetch users (${usersRes.status}): ${t}`);
  process.exit(1);
}
const usersData = await usersRes.json();
const users = usersData.users || usersData;
if (!users || users.length === 0) {
  console.error("ERROR: No users found in auth.users — sign up first.");
  process.exit(1);
}
const userId = users[0].id;
console.log(`  user_id: ${userId}  (${users[0].email})`);

// ---------------------------------------------------------------------------
// 4. Create org_member (owner)
// ---------------------------------------------------------------------------
console.log("\n--- Linking user as owner ---");
const [member] = await sbPost("org_members", {
  org_id: org.id,
  user_id: userId,
  role: "owner",
});
console.log(`  member_id: ${member.id}`);

// ---------------------------------------------------------------------------
// 5. Create project
// ---------------------------------------------------------------------------
console.log("\n--- Creating project ---");
const [project] = await sbPost("projects", {
  org_id: org.id,
  name: "Production",
  slug: "production",
});
console.log(`  project_id: ${project.id}`);

// ---------------------------------------------------------------------------
// 6. Generate + store API key
// ---------------------------------------------------------------------------
console.log("\n--- Generating API key ---");
const rawKey = "ab_" + randomBytes(32).toString("hex"); // ab_ + 64 hex chars
const keyHash = hashApiKey(rawKey);
const keyPrefix = rawKey.slice(0, 12);

const [apiKeyRow] = await sbPost("api_keys", {
  project_id: project.id,
  key_hash: keyHash,
  key_prefix: keyPrefix,
  name: "seed-key",
  environment: "production",
});
console.log(`  api_key_id: ${apiKeyRow.id}`);
console.log(`  key_prefix: ${keyPrefix}`);

// ---------------------------------------------------------------------------
// 7. Generate realistic trace spans
// ---------------------------------------------------------------------------
console.log("\n--- Generating trace data ---");

const AGENTS = {
  "support-bot": {
    weight: 0.6,
    model: "claude-sonnet-4-20250514",
    provider: "anthropic",
    tokenRange: [200, 2000],
    durationRange: [500, 3000],
    tools: ["search_kb", "create_ticket", "lookup_customer", "send_reply"],
    inputs: [
      "How do I reset my password?",
      "My order hasn't arrived yet, order #4821",
      "Can I get a refund for my subscription?",
      "I'm getting error 503 when I try to log in",
      "How do I upgrade my plan?",
      "I need to change my billing address",
      "The app crashes when I open settings",
      "Where can I find my invoices?",
      "I want to cancel my account",
      "Can you help me integrate your API?",
      "My payment was declined but money was deducted",
      "How do I add team members?",
    ],
    outputs: [
      "I've found the relevant help article. To reset your password, go to Settings > Security > Reset Password.",
      "I've looked up order #4821. It was shipped on Monday and is currently in transit. Expected delivery is Thursday.",
      "I can process that refund for you. I've initiated a refund of $29.99 to your original payment method.",
      "Error 503 usually indicates a temporary server issue. I've checked and our services are operational now. Please try again.",
      "To upgrade your plan, navigate to Settings > Billing > Change Plan. You'll see the available options there.",
      "I've updated your billing address. The change will be reflected on your next invoice.",
      "I've created ticket #TK-2847 for the app crash issue. Our engineering team will investigate.",
      "You can find all your invoices under Settings > Billing > Invoice History.",
      "I understand. I've initiated the account cancellation process. You'll receive a confirmation email.",
      "Here's our API quickstart guide. You'll need to generate an API key from your dashboard first.",
    ],
    errors: [
      "Knowledge base search timed out",
      "Failed to create ticket: service unavailable",
      "Customer lookup returned empty result",
    ],
  },
  "code-review": {
    weight: 0.25,
    model: "claude-opus-4-20250514",
    provider: "anthropic",
    tokenRange: [500, 5000],
    durationRange: [2000, 8000],
    tools: ["read_file", "list_changes", "post_comment", "run_linter"],
    inputs: [
      "Review PR #142: Add user authentication middleware",
      "Review PR #156: Refactor database connection pooling",
      "Review PR #170: Fix race condition in queue worker",
      "Review PR #183: Add rate limiting to API endpoints",
      "Review PR #201: Migrate from REST to GraphQL",
      "Review PR #215: Update dependency versions",
      "Review PR #228: Add caching layer for frequently accessed data",
      "Review PR #240: Implement webhook retry logic",
    ],
    outputs: [
      "Found 3 issues: 1) Missing input validation on line 45. 2) SQL injection risk in query builder. 3) No error handling for network timeouts. Requesting changes.",
      "LGTM. The connection pooling implementation follows best practices. Minor suggestion: consider adding a health check endpoint.",
      "Critical: The mutex lock on line 87 can deadlock under high concurrency. Suggest using a channel-based approach instead.",
      "Approved with minor comments. Rate limiting looks good but consider adding per-user limits in addition to global limits.",
      "The GraphQL schema has N+1 query issues. Recommend adding DataLoader for batch loading. Also, missing pagination on list queries.",
      "Two security vulnerabilities found in updated deps. lodash@4.17.20 has prototype pollution. Recommend upgrading to 4.17.21+.",
    ],
    errors: [
      "Failed to read file: repository not accessible",
      "Linter process exited with code 1",
      "GitHub API rate limit exceeded",
    ],
  },
  "email-draft": {
    weight: 0.1,
    model: "gpt-4o",
    provider: "openai",
    tokenRange: [200, 3000],
    durationRange: [800, 4000],
    tools: ["fetch_template", "lookup_contact", "schedule_send"],
    inputs: [
      "Draft a follow-up email to the client about the project timeline",
      "Write a welcome email for new team member Sarah Chen",
      "Compose a quarterly business review summary for stakeholders",
      "Draft a meeting recap email for the product sync",
      "Write an apology email about the service outage",
      "Compose a partnership proposal email to Acme Corp",
    ],
    outputs: [
      "Subject: Project Timeline Update\n\nHi Team,\n\nI wanted to provide an update on our project timeline. We're on track for the Q2 milestone...",
      "Subject: Welcome to the Team, Sarah!\n\nDear Sarah,\n\nWe're thrilled to have you join our engineering team...",
      "Subject: Q1 Business Review Summary\n\nDear Stakeholders,\n\nI'm pleased to share our Q1 results. Revenue grew 23% YoY...",
      "Subject: Product Sync Recap — April 15\n\nHi everyone,\n\nHere's a summary of today's product sync meeting...",
      "Subject: Service Disruption — Post-Incident Report\n\nDear Customers,\n\nWe experienced a 47-minute outage...",
    ],
    errors: [
      "Template not found: quarterly_review_v2",
      "Contact lookup failed: invalid email format",
    ],
  },
  classifier: {
    weight: 0.05,
    model: "claude-haiku-3-5-20241022",
    provider: "anthropic",
    tokenRange: [100, 500],
    durationRange: [200, 800],
    tools: ["classify", "route_intent"],
    inputs: [
      "I want to cancel my subscription",
      "How much does the pro plan cost?",
      "Your service is terrible, I want a refund",
      "Can you help me set up the integration?",
      "I'm interested in enterprise pricing",
      "My API key isn't working",
      "Great product, love the dashboard!",
      "Is there a free trial available?",
    ],
    outputs: [
      '{"intent": "cancellation", "sentiment": "neutral", "priority": "medium", "department": "retention"}',
      '{"intent": "pricing_inquiry", "sentiment": "neutral", "priority": "low", "department": "sales"}',
      '{"intent": "complaint", "sentiment": "negative", "priority": "high", "department": "support"}',
      '{"intent": "technical_support", "sentiment": "neutral", "priority": "medium", "department": "engineering"}',
      '{"intent": "enterprise_sales", "sentiment": "positive", "priority": "high", "department": "sales"}',
      '{"intent": "technical_issue", "sentiment": "negative", "priority": "high", "department": "support"}',
      '{"intent": "feedback", "sentiment": "positive", "priority": "low", "department": "product"}',
      '{"intent": "pricing_inquiry", "sentiment": "neutral", "priority": "low", "department": "sales"}',
    ],
    errors: ["Classification confidence below threshold (0.32)"],
  },
};

const SESSION_IDS = Array.from({ length: 30 }, () => randomUUID());
const END_USER_IDS = [
  "user_k8x2m", "user_p3n7q", "user_z9w4r", "user_a1b5c",
  "user_d6e8f", "user_g2h0j", "user_l4m9n", "user_t7u3v",
  "user_w5x1y", "user_q8r6s",
];

const now = Date.now();
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function generateTimestamp() {
  // Spread across last 7 days with business-hour bias
  const offset = Math.random() * SEVEN_DAYS_MS;
  const ts = new Date(now - offset);
  // Bias toward business hours (8am-6pm) — reject and re-roll 60% of non-business hours
  const hour = ts.getUTCHours();
  if ((hour < 8 || hour > 18) && Math.random() < 0.6) {
    // Shift into business hours
    ts.setUTCHours(rand(9, 17), rand(0, 59), rand(0, 59));
  }
  return ts;
}

function generateTrace(agentName) {
  const cfg = AGENTS[agentName];
  const traceId = randomUUID();
  const parentSpanId = randomUUID();
  const startedAt = generateTimestamp();
  const isError = Math.random() < 0.05;
  const sessionId = pick(SESSION_IDS);
  const endUserId = pick(END_USER_IDS);
  const spans = [];

  // --- Agent (parent) span ---
  const totalDuration = rand(cfg.durationRange[0], cfg.durationRange[1]);
  const agentEnded = new Date(startedAt.getTime() + totalDuration);

  spans.push({
    trace_id: traceId,
    span_id: parentSpanId,
    agent_name: agentName,
    agent_version: "1.0.0",
    environment: "production",
    span_name: `${agentName}.run`,
    span_kind: "agent",
    status: isError ? "error" : "ok",
    started_at: startedAt.toISOString(),
    ended_at: agentEnded.toISOString(),
    duration_ms: totalDuration,
    input_preview: pick(cfg.inputs),
    output_preview: isError ? undefined : pick(cfg.outputs),
    session_id: sessionId,
    end_user_id: endUserId,
    error_message: isError ? pick(cfg.errors) : undefined,
    error_type: isError ? "AgentError" : undefined,
    metadata: { sdk_version: "0.1.0" },
  });

  // --- LLM span ---
  const llmDuration = rand(
    Math.floor(totalDuration * 0.4),
    Math.floor(totalDuration * 0.7),
  );
  const llmStartOffset = rand(50, 200);
  const llmStarted = new Date(startedAt.getTime() + llmStartOffset);
  const inputTokens = rand(cfg.tokenRange[0], cfg.tokenRange[1]);
  const outputTokens = rand(
    Math.floor(cfg.tokenRange[0] * 0.5),
    Math.floor(cfg.tokenRange[1] * 0.8),
  );
  const ttft = rand(50, Math.floor(llmDuration * 0.3));

  spans.push({
    trace_id: traceId,
    span_id: randomUUID(),
    parent_span_id: parentSpanId,
    agent_name: agentName,
    agent_version: "1.0.0",
    environment: "production",
    span_name: `${cfg.provider}.chat`,
    span_kind: "llm",
    status: isError ? "error" : "ok",
    model_provider: cfg.provider,
    model_name: cfg.model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    started_at: llmStarted.toISOString(),
    ended_at: new Date(llmStarted.getTime() + llmDuration).toISOString(),
    duration_ms: llmDuration,
    ttft_ms: ttft,
    input_preview: pick(cfg.inputs),
    output_preview: isError ? undefined : pick(cfg.outputs),
    session_id: sessionId,
    end_user_id: endUserId,
    error_message: isError ? pick(cfg.errors) : undefined,
    error_type: isError ? "LLMError" : undefined,
    metadata: {},
  });

  // --- Tool spans (1-2 per trace) ---
  const toolCount = rand(1, 2);
  let toolOffset = llmStartOffset + llmDuration + rand(10, 50);
  for (let i = 0; i < toolCount; i++) {
    const toolDuration = rand(20, 300);
    const toolStarted = new Date(startedAt.getTime() + toolOffset);
    const toolName = pick(cfg.tools);

    spans.push({
      trace_id: traceId,
      span_id: randomUUID(),
      parent_span_id: parentSpanId,
      agent_name: agentName,
      agent_version: "1.0.0",
      environment: "production",
      span_name: toolName,
      span_kind: "tool",
      status: isError && i === 0 ? "error" : "ok",
      started_at: toolStarted.toISOString(),
      ended_at: new Date(toolStarted.getTime() + toolDuration).toISOString(),
      duration_ms: toolDuration,
      input_preview: `${toolName}(...)`,
      output_preview: isError && i === 0 ? "Error" : "Success",
      session_id: sessionId,
      end_user_id: endUserId,
      error_message:
        isError && i === 0 ? pick(cfg.errors) : undefined,
      error_type: isError && i === 0 ? "ToolError" : undefined,
      metadata: {},
    });

    toolOffset += toolDuration + rand(10, 30);
  }

  return spans;
}

// Build weighted agent list
const agentWeighted = [];
for (const [name, cfg] of Object.entries(AGENTS)) {
  const count = Math.round(cfg.weight * 100);
  for (let i = 0; i < count; i++) agentWeighted.push(name);
}

// Generate ~70 traces -> 200+ spans
const TARGET_TRACES = 75;
const allSpans = [];
for (let i = 0; i < TARGET_TRACES; i++) {
  const agent = pick(agentWeighted);
  allSpans.push(...generateTrace(agent));
}

console.log(
  `  Generated ${allSpans.length} spans across ${TARGET_TRACES} traces`,
);

// ---------------------------------------------------------------------------
// 8. Ingest spans in batches of 50
// ---------------------------------------------------------------------------
console.log("\n--- Ingesting spans ---");
const BATCH_SIZE = 50;
const INGEST_URL = "http://localhost:3001/api/v1/ingest";

let totalAccepted = 0;
for (let i = 0; i < allSpans.length; i += BATCH_SIZE) {
  const batch = allSpans.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(allSpans.length / BATCH_SIZE);

  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-AgentBeam-Key": rawKey,
    },
    body: JSON.stringify({
      spans: batch,
      sdk_version: "0.1.0",
      sdk_language: "python",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`  Batch ${batchNum}/${totalBatches} FAILED (${res.status}): ${text}`);
    continue;
  }

  const result = await res.json();
  totalAccepted += result.accepted;
  console.log(
    `  Batch ${batchNum}/${totalBatches}: ${result.accepted} spans accepted`,
  );
}

// ---------------------------------------------------------------------------
// 9. Summary
// ---------------------------------------------------------------------------
console.log("\n===================================");
console.log("  Seed complete!");
console.log("===================================");
console.log(`  Organization: My Workspace (${org.id})`);
console.log(`  Project:      Production (${project.id})`);
console.log(`  Spans sent:   ${totalAccepted}`);
console.log(`  API Key:      ${rawKey}`);
console.log("===================================");
console.log("  (This is the only time the API key is shown)");
console.log("");
