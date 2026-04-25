# AgentBeam — Claude Code Instructions

## Project Overview
AgentBeam is an AI agent infrastructure platform. See SPEC.md for full product details.

## Monorepo Structure
- `apps/dashboard/` — Next.js 15 web app (App Router)
- `packages/sdk-node/` — TypeScript SDK (npm: agentbeam)
- `packages/sdk-python/` — Python SDK (PyPI: agentbeam)
- `packages/shared/` — Shared types, model pricing table
- `supabase/` — Database migrations
- `scripts/` — Build and deploy scripts

## Tech Stack
- **Frontend**: Next.js 15 + shadcn/ui + Tailwind CSS + TanStack Query + Recharts
- **Database**: Supabase PostgreSQL (app data) + ClickHouse Cloud (traces at scale)
- **Hosting**: Cloudflare Pages + Workers
- **Auth**: Supabase Auth
- **SDKs**: Python + TypeScript

## Key Commands
- `pnpm dev` — Start dashboard dev server
- `pnpm build` — Build dashboard for production
- `node scripts/migrate.mjs` — Run database migrations

## Environment Variables
All secrets are in `.env` (gitignored). See `.env.example` for the template.

## Conventions
- Use TypeScript strict mode
- Use `@/` path alias for imports in the dashboard
- Database migrations are numbered: `001_name.sql`, `002_name.sql`
- API routes live in `apps/dashboard/app/api/v1/`
- Use Supabase client from `@/lib/supabase/`
