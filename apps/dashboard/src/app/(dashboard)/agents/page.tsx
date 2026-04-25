'use client';

import { useQuery } from '@tanstack/react-query';
import { useProjectContext } from '@/lib/project-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatCurrency,
  formatDuration,
  formatRelativeTime,
  formatNumber,
} from '@/lib/utils/format';
import { BotIcon, InboxIcon, InfoIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AgentSummary {
  agent_name: string;
  total_traces: number;
  total_cost: number;
  error_count: number;
  error_rate: number;
  avg_duration_ms: number | null;
  last_active: string;
  top_model: string | null;
}

interface AgentsResponse {
  agents: AgentSummary[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const FIVE_MINUTES_MS = 5 * 60 * 1000;

function isRecentlyActive(lastActive: string): boolean {
  return Date.now() - new Date(lastActive).getTime() < FIVE_MINUTES_MS;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AgentsPage() {
  const { projectId: contextProjectId } = useProjectContext();
  const projectId = contextProjectId ?? '';

  const { data, isLoading, error } = useQuery<AgentsResponse>({
    queryKey: ['agents', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/agents?project_id=${projectId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to fetch agents');
      }
      return res.json();
    },
    enabled: !!projectId,
    refetchInterval: 30_000,
  });

  const agents = data?.agents ?? [];

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-muted-foreground">
          Auto-discovered agents from your trace data.
        </p>
      </div>

      {!projectId ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <InboxIcon className="size-10 opacity-40" />
              <p className="text-sm">
                No project selected. Create one in{' '}
                <a
                  href="/settings"
                  className="text-primary underline underline-offset-2"
                >
                  Settings
                </a>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <AgentCardsSkeleton />
      ) : error ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex items-center justify-center text-sm text-muted-foreground">
              Error loading agents:{' '}
              {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          </CardContent>
        </Card>
      ) : agents.length === 0 ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                <BotIcon className="size-5 text-blue-400" />
              </div>
              <div>
                <CardTitle>Connect Your First Agent</CardTitle>
                <CardDescription>
                  Agents automatically appear here when they send their first
                  trace. Here&apos;s how to get started:
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-6">
              {/* Step 1 */}
              <li className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium text-muted-foreground ring-1 ring-white/[0.08]">
                  1
                </span>
                <div>
                  <p className="text-sm font-medium">Get your API key</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Go to{' '}
                    <a
                      href="/settings"
                      className="text-primary underline underline-offset-2"
                    >
                      Settings
                    </a>{' '}
                    &rarr; Generate New Key
                  </p>
                </div>
              </li>

              {/* Step 2 */}
              <li className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium text-muted-foreground ring-1 ring-white/[0.08]">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Install and run (no code changes needed)</p>
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/30 p-3 text-xs leading-relaxed text-zinc-300">
                    <code>{`# Python
pip install agentbeam
AGENTBEAM_API_KEY=your_key python -m agentbeam your_script.py

# Node.js
npm install agentbeam
AGENTBEAM_API_KEY=your_key node --require agentbeam/auto app.js`}</code>
                  </pre>
                </div>
              </li>

              {/* Step 3 */}
              <li className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium text-muted-foreground ring-1 ring-white/[0.08]">
                  3
                </span>
                <div>
                  <p className="text-sm font-medium">Run your agent</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Your agents will appear here automatically.
                  </p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0 opacity-60" />
            <span>
              Agents are auto-discovered from trace data. They appear when they
              send their first trace.
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.agent_name} agent={agent} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Agent Card
// ---------------------------------------------------------------------------
function AgentCard({ agent }: { agent: AgentSummary }) {
  const active = isRecentlyActive(agent.last_active);
  const errorPct =
    agent.total_traces > 0
      ? ((agent.error_rate) * 100).toFixed(1)
      : '0.0';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block size-2 rounded-full ${
                active ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-muted-foreground/40'
              }`}
              title={active ? 'Active (last 5 min)' : 'Idle'}
            />
            <CardTitle className="truncate">{agent.agent_name}</CardTitle>
          </div>
          {agent.top_model && (
            <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
              {agent.top_model}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <StatItem label="Requests" value={formatNumber(agent.total_traces)} />
          <StatItem label="Total Cost" value={formatCurrency(agent.total_cost)} />
          <StatItem
            label="Error Rate"
            value={`${errorPct}%`}
            valueClassName={
              Number(errorPct) > 5
                ? 'text-red-400'
                : Number(errorPct) > 0
                  ? 'text-amber-400'
                  : undefined
            }
          />
          <StatItem
            label="Avg Latency"
            value={
              agent.avg_duration_ms != null
                ? formatDuration(agent.avg_duration_ms)
                : '--'
            }
          />
        </div>
        <div className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-muted-foreground">
          Last active {formatRelativeTime(agent.last_active)}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Stat Item
// ---------------------------------------------------------------------------
function StatItem({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium tabular-nums ${valueClassName ?? ''}`}>
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
function AgentCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-5 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j}>
                  <Skeleton className="mb-1 h-3 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-white/[0.06] pt-3">
              <Skeleton className="h-3 w-28" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
