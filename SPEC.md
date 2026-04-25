# AgentBeam — Product & Technical Specification

> AI Agent Infrastructure Platform — The plumbing for AI agents in production.
> "Be the Datadog of AI agents, at 1/10th the price, purpose-built from day one."

---

## WHAT IS AGENTBEAM

AgentBeam is a platform that helps companies monitor, debug, and manage the cost of their AI agents in production. When a company deploys AI agents (customer support bots, code review agents, data processing agents, etc.), they need to know:

- What are my agents doing right now?
- How much are they costing me?
- Why did that agent fail?
- Which agent is burning the most money?
- Is my agent getting slower?

AgentBeam answers all of these with a simple SDK integration (3 lines of code) and a real-time dashboard.

---

## TARGET CUSTOMERS

| Segment | Description | Why They Need Us |
|---|---|---|
| **Startup AI teams** (3-20 devs) | Building agents with LangChain, CrewAI, raw API calls | Can't afford Datadog. Need simple, affordable monitoring |
| **Enterprise AI teams** | Deploying 10-50+ agents across departments | Need cost attribution, audit trails, security, compliance |
| **Solo AI builders** | Indie hackers shipping AI products | Need to know what their agent costs before it bankrupts them |
| **AI consultancies** | Building agents for clients | Need per-client cost tracking and reporting |

---

## THE 8 PILLARS

### MVP (Launch — Building Now)

#### Pillar 1: Agent Observatory (Real-Time Monitoring & Traces)
Live visibility into every AI agent running in production.

**Features:**
- **Live Agent Dashboard** — Real-time view of every agent: status, current task, model, cost
- **Full Trace Replay** — Record and replay every step an agent took (LLM calls, tool usage, decisions)
- **Multi-Step Workflow Visualization** — Visual graph of agent reasoning chains and tool calls
- **Latency Tracking** — Per-step latency breakdown (which call is slow?)
- **Anomaly Detection** — Alerts when agent behavior deviates from normal
- **Custom Alerts & Webhooks** — Slack/email alerts for error rates, latency spikes, cost thresholds
- **Error Tracking** — Detailed error messages, stack traces, failure categorization

#### Pillar 2: Cost Command Center (Financial Control)
Know exactly what every agent costs, down to the penny.

**Features:**
- **Per-Agent Cost Attribution** — Break down spend by agent, task, user, team, department
- **Token-Level Analytics** — Input vs output tokens, cached vs fresh, by model, by provider
- **Budget Caps & Kill Switches** — Hard limits per agent/team/day. Auto-pause runaway agents
- **Cost Forecasting** — ML-based prediction of future spend based on usage patterns
- **Provider Comparison** — What would this workload cost on OpenAI vs Anthropic vs Gemini?
- **ROI Calculator** — Map agent costs to business outcomes
- **Optimization Suggestions** — AI-powered tips: "Switch this agent to Haiku, save $1,200/mo"

---

### Coming Soon (Post-Launch — Pages Live, Features Not Built)

#### Pillar 3: Agent Security Vault
- Agent Identity Management (no more shared API keys)
- Least-Privilege Access Control per agent
- Input/Output Guardrails (prompt injection, PII detection)
- Full Audit Trail (immutable logs)
- Secrets Management (centralized vault)
- Sandbox Environments (safe testing)
- Compliance Templates (EU AI Act, SOC 2, HIPAA, GDPR)

#### Pillar 4: Agent Testing Lab
- Scenario Simulator (synthetic users, edge cases)
- Regression Testing (auto re-run tests on prompt changes)
- A/B Testing Framework (compare models, prompts, configs)
- Human-in-the-Loop Evaluation
- Production Replay Testing (real conversations → new agent version)
- Eval-Gated Deploys (CI/CD for agents — block bad prompts from shipping)
- Benchmark Dashboard (track quality over time)

#### Pillar 5: Agent Deployment Engine
- One-Click Deploy (code → containerized → deployed → monitored)
- Intelligent Model Router (route by complexity, cost, latency)
- Automatic Failover (OpenAI down → switch to Anthropic)
- Auto-Scaling
- Canary Deployments (5% → 25% → 100%)
- Multi-Region deployment
- One-Click Rollback

#### Pillar 6: Agent Collaboration Hub (Multi-Agent Orchestration)
- Agent Registry (catalog of all agents in org)
- Handoff Protocols (agent-to-agent task transfer)
- Shared Memory / Context Store
- Agent-to-Agent Communication (typed contracts)
- Dependency Graph (which agents depend on which)
- Visual Workflow Builder (drag-and-drop)

#### Pillar 7: Prompt Engineering Studio
- Prompt Version Control (git-like)
- Prompt Playground (test against real data, compare side-by-side)
- Prompt Templates Library
- Prompt Analytics (which prompts perform best)
- Collaborative Editing (comments, approvals, reviews)

#### Pillar 8: Compliance & Governance Center
- Risk Classification (EU AI Act categories)
- Data Lineage (what data did the agent access/produce)
- Bias Detection
- Incident Response Playbooks (auto-quarantine misbehaving agents)
- Regulatory Reporting (auto-generate compliance reports)

---

## TECH STACK

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 15 (App Router) | Dashboard web app |
| **UI Components** | shadcn/ui + Tailwind CSS | Clean, professional component library |
| **Charts** | Recharts or Tremor | Time-series cost charts, latency graphs |
| **State Management** | TanStack Query | Server state, caching, real-time refetch |
| **Hosting (Frontend)** | Cloudflare Pages | Fast, free, global CDN |
| **Auth** | Supabase Auth | User accounts, orgs, sessions |
| **App Database** | Supabase PostgreSQL | Users, orgs, projects, API keys, configs |
| **Traces Database** | Supabase PostgreSQL (MVP) → ClickHouse (scale) | Trace spans, metrics, cost data |
| **Real-Time** | Supabase Realtime | Live dashboard updates |
| **Edge Ingestion** | Cloudflare Workers | Low-latency SDK data ingestion |
| **Email** | Resend (free 100/day) | Alert notifications |
| **Python SDK** | Python package (PyPI) | Customer integration for Python agents |
| **TypeScript SDK** | npm package | Customer integration for Node.js agents |
| **Billing** | Stripe (when monetizing) | Usage-based subscriptions |

---

## MONOREPO STRUCTURE

```
AgentBeam/
├── apps/
│   ├── dashboard/          # Next.js 15 — main web app
│   │   ├── app/            # App Router pages
│   │   │   ├── (auth)/     # Login, signup, forgot password
│   │   │   ├── (dashboard)/# Authenticated dashboard pages
│   │   │   │   ├── overview/      # Mission Control home
│   │   │   │   ├── traces/        # Trace explorer + detail
│   │   │   │   ├── costs/         # Cost analytics
│   │   │   │   ├── agents/        # Agent registry
│   │   │   │   ├── alerts/        # Alert configuration
│   │   │   │   └── settings/      # Project settings, API keys
│   │   │   ├── (marketing)/# Public landing pages
│   │   │   │   ├── page.tsx       # Homepage
│   │   │   │   ├── pricing/       # Pricing page
│   │   │   │   ├── docs/          # Documentation
│   │   │   │   └── coming-soon/   # Pillar 3-8 waitlist pages
│   │   │   └── api/        # API routes
│   │   │       └── v1/
│   │   │           ├── ingest/    # Receive traces from SDKs
│   │   │           ├── traces/    # Query traces
│   │   │           ├── costs/     # Query cost data
│   │   │           └── alerts/    # Manage alerts
│   │   ├── components/     # React components
│   │   │   ├── ui/         # shadcn/ui base components
│   │   │   ├── dashboard/  # Dashboard-specific components
│   │   │   ├── traces/     # Trace viewer components
│   │   │   ├── costs/      # Cost chart components
│   │   │   └── marketing/  # Landing page components
│   │   ├── lib/            # Shared utilities
│   │   │   ├── supabase/   # Supabase client + queries
│   │   │   ├── hooks/      # Custom React hooks
│   │   │   └── utils/      # Helper functions
│   │   └── public/         # Static assets
│   │
│   └── api/                # Standalone API (if needed beyond Next.js routes)
│
├── packages/
│   ├── sdk-node/           # TypeScript/Node.js SDK
│   │   ├── src/
│   │   │   ├── index.ts           # Main entry + init()
│   │   │   ├── client.ts          # HTTP client to AgentBeam API
│   │   │   ├── trace.ts           # Span/trace management
│   │   │   ├── instruments/       # Auto-instrumentation
│   │   │   │   ├── anthropic.ts   # Wrap Anthropic SDK
│   │   │   │   ├── openai.ts      # Wrap OpenAI SDK
│   │   │   │   └── langchain.ts   # Wrap LangChain (later)
│   │   │   ├── cost.ts            # Token counting + cost calc
│   │   │   └── types.ts           # Shared types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── sdk-python/         # Python SDK
│   │   ├── agentbeam/
│   │   │   ├── __init__.py        # Main entry + init()
│   │   │   ├── client.py          # HTTP client to AgentBeam API
│   │   │   ├── trace.py           # Span/trace management
│   │   │   ├── instruments/       # Auto-instrumentation
│   │   │   │   ├── anthropic.py   # Patch Anthropic SDK
│   │   │   │   ├── openai.py      # Patch OpenAI SDK
│   │   │   │   └── langchain.py   # Patch LangChain (later)
│   │   │   ├── cost.py            # Token counting + cost calc
│   │   │   └── types.py           # Type definitions
│   │   ├── pyproject.toml
│   │   └── tests/
│   │
│   └── shared/             # Shared types & constants
│       ├── src/
│       │   ├── models.ts          # Pricing table, model metadata
│       │   ├── types.ts           # Shared TypeScript types
│       │   └── constants.ts       # API versions, limits
│       └── package.json
│
├── supabase/
│   ├── migrations/         # Database migrations (versioned)
│   │   ├── 001_users_orgs.sql
│   │   ├── 002_projects_apikeys.sql
│   │   ├── 003_traces.sql
│   │   ├── 004_cost_rollups.sql
│   │   └── 005_alerts.sql
│   └── config.toml
│
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Lint, type-check, test
│       └── deploy.yml             # Deploy to Cloudflare Pages
│
├── SPEC.md                 # This file — the product bible
├── package.json            # Root monorepo config
├── pnpm-workspace.yaml     # Workspace definition
├── turbo.json              # Turborepo build config
├── .gitignore
├── .env.example            # Template for environment variables
└── CLAUDE.md               # Instructions for Claude Code
```

---

## DATABASE SCHEMA (Supabase PostgreSQL)

### Core Tables

```sql
-- Organizations (multi-tenant)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization members
CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, user_id)
);

-- Projects (within organizations)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, slug)
);

-- API Keys (for SDK authentication)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,         -- bcrypt hash of the actual key
    key_prefix TEXT NOT NULL,       -- first 8 chars for identification (ab_xxxxxxxx)
    name TEXT NOT NULL,             -- human-readable label
    environment TEXT DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'development')),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ          -- soft delete
);

-- Traces (main telemetry data)
CREATE TABLE traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    trace_id UUID NOT NULL,         -- groups spans into one trace
    parent_span_id UUID,            -- null for root spans

    -- Agent context
    agent_name TEXT,
    agent_version TEXT,
    environment TEXT DEFAULT 'production',

    -- Span details
    span_name TEXT NOT NULL,
    span_kind TEXT NOT NULL CHECK (span_kind IN ('agent', 'llm', 'tool', 'chain', 'retrieval', 'custom')),
    status TEXT DEFAULT 'ok' CHECK (status IN ('ok', 'error', 'timeout')),

    -- LLM-specific fields
    model_provider TEXT,            -- anthropic, openai, google, etc.
    model_name TEXT,                -- claude-sonnet-4-20250514, gpt-4o, etc.
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,

    -- Cost (calculated at ingestion using pricing table)
    cost_usd DECIMAL(12,8) DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_ms INTEGER,
    ttft_ms INTEGER,                -- time to first token

    -- Content (truncated previews for dashboard display)
    input_preview TEXT,             -- first 500 chars of input
    output_preview TEXT,            -- first 500 chars of output

    -- Metadata
    metadata JSONB DEFAULT '{}',
    user_id TEXT,                   -- end-user attribution (customer's user)
    session_id TEXT,                -- group related interactions

    -- Error details
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

-- Cost rollups (materialized for fast dashboard queries)
CREATE TABLE cost_rollups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    agent_name TEXT,
    model_provider TEXT,
    model_name TEXT,
    hour TIMESTAMPTZ NOT NULL,      -- truncated to hour

    -- Aggregated metrics
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

-- Alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cost_threshold', 'error_rate', 'latency', 'anomaly')),
    config JSONB NOT NULL,          -- threshold values, conditions
    channels JSONB NOT NULL,        -- where to send: slack, email, webhook
    enabled BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Alert history
CREATE TABLE alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    triggered_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    details JSONB                   -- snapshot of what triggered it
);
```

---

## SDK INTEGRATION (What Customers See)

### Python (3 lines to integrate)
```python
import agentbeam
agentbeam.init(api_key="ab_your_key_here")

# That's it. All Anthropic/OpenAI calls are now traced automatically.
# Use your LLM libraries normally — AgentBeam patches them.
```

### TypeScript (3 lines to integrate)
```typescript
import { AgentBeam } from 'agentbeam';
const ab = new AgentBeam({ apiKey: 'ab_your_key_here' });

// Wrap your client — all calls are now traced
const anthropic = ab.wrap(new Anthropic());
```

### What Gets Captured Automatically
- Model name, provider, version
- Input/output token counts
- Prompt and completion content (optional — can disable for privacy)
- Latency (total + time-to-first-token)
- Tool/function calls and results
- Error messages and stack traces
- Cost (calculated server-side from pricing table)
- Parent-child span relationships (multi-step agents)

---

## PRICING (Future — Not at Launch)

| Tier | Price | Limits | Target |
|---|---|---|---|
| **Free** | $0/mo | 50K traces, 3 agents, 7-day retention, 1 project | Solo devs, evaluation |
| **Pro** | $79/mo | 1M traces, unlimited agents, 90-day retention, 10 projects, team (5), alerts | Startups, small teams |
| **Enterprise** | Custom | Unlimited everything, SSO, SLA, on-prem option, compliance | Large organizations |
| **Usage add-on** | $20/1M traces | Scales with customer growth | All paid tiers |

---

## ACCOUNTS NEEDED (All Free Tier)

### Step 1: GitHub ✅ (Already have)
- Repository hosting
- CI/CD via GitHub Actions
- Already signed up

### Step 2: Supabase ✅ (Already have)
- **URL**: supabase.com
- **What to do**: Create a new project called "agentbeam"
- **Region**: Pick closest to you
- **Save**: Project URL + anon key + service role key
- **Free tier**: 500MB database, 50K MAU auth, 2 projects

### Step 3: Cloudflare ❌ (Need to sign up)
- **URL**: cloudflare.com → Sign up
- **What to do**: Create account (email + password). No credit card.
- **We use**: Cloudflare Pages (dashboard hosting) + Workers (edge API)
- **Free tier**: Unlimited bandwidth, 500 builds/mo, 100K worker requests/day

### Step 4: Resend ❌ (Need to sign up — later)
- **URL**: resend.com → Sign up
- **What to do**: Create account. Get API key.
- **We use**: Sending alert notification emails
- **Free tier**: 100 emails/day, 1 custom domain
- **When**: Not needed until we build alerts (Task #7 area)

### Step 5: npm ❌ (Need to sign up — later)
- **URL**: npmjs.com → Sign up
- **What to do**: Create account. Needed to publish TypeScript SDK
- **When**: Not needed until SDK is ready to publish

### Step 6: PyPI ❌ (Need to sign up — later)
- **URL**: pypi.org → Register
- **What to do**: Create account. Needed to publish Python SDK
- **When**: Not needed until SDK is ready to publish

---

## BUILD ORDER

| Phase | Task | Depends On |
|---|---|---|
| 1 | Project structure + monorepo setup | Nothing |
| 2 | Supabase schema + auth setup | Supabase project created |
| 3 | Ingestion API (receive traces) | Schema done |
| 4 | Python SDK (auto-instrument Anthropic + OpenAI) | API done |
| 5 | TypeScript SDK | API done |
| 6 | Dashboard — Auth (login/signup) | Supabase auth |
| 7 | Dashboard — Mission Control (overview) | API + some trace data |
| 8 | Dashboard — Trace Explorer | API |
| 9 | Dashboard — Cost Analytics | Cost rollups working |
| 10 | Alerts (Slack/email) | Dashboard + Resend |
| 11 | Landing page + Coming Soon pages | Can be done anytime |
| 12 | Deploy to Cloudflare Pages | Cloudflare account |

---

## COMPETITIVE POSITIONING

| Competitor | Overlap | Our Edge |
|---|---|---|
| **AgentOps.ai** | Observability, cost tracking, debugging (Pillars 1-2) | Our 8-pillar vision is broader. Security, testing, deployment, compliance not offered by them |
| **LangSmith** | Tracing, evals, prompt management | LangChain-locked. We're framework-agnostic |
| **Langfuse** | Open-source tracing + cost tracking | Acquired by ClickHouse (Jan 2026) — uncertain future |
| **Helicone** | Cost tracking proxy | Single-purpose. We're a full platform |
| **Datadog** | General APM + LLM monitoring | 10x+ our price. AI is bolted on, not native |

**Our differentiator at launch**: Simplest integration (3 lines), best cost analytics, beautiful UI, aggressive free tier, purpose-built for agents (not general APM with AI bolted on).

**Our differentiator long-term**: Only platform covering all 8 pillars of agent infrastructure.

---

*Last updated: 2026-04-24*
*Status: Pre-build — Setting up project*
