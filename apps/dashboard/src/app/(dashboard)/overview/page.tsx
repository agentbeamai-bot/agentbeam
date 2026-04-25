'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSignIcon,
  ActivityIcon,
  AlertTriangleIcon,
  ZapIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  RocketIcon,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  useDashboardData,
} from '@/lib/hooks/use-dashboard-data';
import { useProjectContext } from '@/lib/project-context';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
function formatCost(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(3)}`;
  if (value > 0) return `$${value.toFixed(4)}`;
  return '$0.00';
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatChartHour(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatRelativeTime(iso: string): string {
  if (!iso) return '-';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------
interface StatCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ElementType;
  invertChange?: boolean;
}

function StatCard({ title, value, change, icon: Icon, invertChange }: StatCardProps) {
  const isPositive = invertChange ? change <= 0 : change >= 0;
  const ArrowIcon = change >= 0 ? ArrowUpIcon : ArrowDownIcon;
  const absChange = Math.abs(change);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {absChange > 0 ? (
          <div className="flex items-center gap-1 text-xs">
            <ArrowIcon
              className={`size-3 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}
            />
            <span
              className={isPositive ? 'text-emerald-500' : 'text-red-500'}
            >
              {absChange.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs prev 24h</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">vs prev 24h</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------
function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-2 h-7 w-20" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-[280px] flex-col gap-3 p-2">
      <div className="flex items-end gap-2 flex-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="size-2 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20 ml-auto" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding Card
// ---------------------------------------------------------------------------
function OnboardingCard() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <Card className="max-w-md w-full">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <RocketIcon className="size-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Welcome to AgentBeam</CardTitle>
          <CardDescription>
            Create your first project to start monitoring your AI agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <a
            href="/settings"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PlusIcon className="size-4" />
            Create your first project
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart Tooltip
// ---------------------------------------------------------------------------
function CostTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-xs text-muted-foreground">
        {new Date(label).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      <p className="text-sm font-semibold">{formatCost(payload[0].value)}</p>
    </div>
  );
}

function AgentTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { agent_name: string } }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-xs text-muted-foreground">
        {payload[0].payload.agent_name}
      </p>
      <p className="text-sm font-semibold">
        {formatNumber(payload[0].value)} requests
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function OverviewPage() {
  const {
    projectId: activeProjectId,
    projects,
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjectContext();

  const { stats, costTimeseries, agentSummaries, isLoading, error } =
    useDashboardData(activeProjectId);

  // --- Loading state for projects ---
  if (projectsLoading) {
    return (
      <>
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </>
    );
  }

  // --- Error state ---
  if (projectsError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-lg text-destructive">
              Failed to load projects
            </CardTitle>
            <CardDescription>
              {projectsError.message ?? 'An unexpected error occurred.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // --- No projects: onboarding ---
  if (!projects || projects.length === 0) {
    return (
      <>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Mission Control
          </h1>
          <p className="text-muted-foreground">
            Monitor your AI agents in real time.
          </p>
        </div>
        <OnboardingCard />
      </>
    );
  }

  // --- Dashboard with data ---
  const hasCostData = costTimeseries.length > 0;
  const hasAgentData = agentSummaries.length > 0;

  return (
    <>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Mission Control
        </h1>
        <p className="text-muted-foreground">
          Monitor your AI agents in real time.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))
        ) : (
          <>
            <StatCard
              title="Total Cost"
              value={formatCost(stats?.totalCost ?? 0)}
              change={stats?.costChange ?? 0}
              icon={DollarSignIcon}
            />
            <StatCard
              title="Total Requests"
              value={formatNumber(stats?.totalRequests ?? 0)}
              change={stats?.requestsChange ?? 0}
              icon={ActivityIcon}
            />
            <StatCard
              title="Error Rate"
              value={`${(stats?.errorRate ?? 0).toFixed(1)}%`}
              change={stats?.errorRateChange ?? 0}
              icon={AlertTriangleIcon}
              invertChange
            />
            <StatCard
              title="Avg Latency"
              value={formatLatency(stats?.avgLatency ?? 0)}
              change={stats?.latencyChange ?? 0}
              icon={ZapIcon}
              invertChange
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Cost Over Time */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Cost Over Time</CardTitle>
            <CardDescription>
              Hourly cost for the last 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : !hasCostData ? (
              <EmptyState message="No data yet. Connect an SDK to get started." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={costTimeseries}>
                  <defs>
                    <linearGradient
                      id="costGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={formatChartHour}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatCost(v)}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip content={<CostTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="total_cost"
                    stroke="hsl(var(--primary))"
                    fill="url(#costGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Requests by Agent */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Requests by Agent</CardTitle>
            <CardDescription>
              Request count per agent, last 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : !hasAgentData ? (
              <EmptyState message="No data yet. Connect an SDK to get started." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={agentSummaries}
                  layout="vertical"
                  margin={{ left: 0, right: 16 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="agent_name"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip content={<AgentTooltipContent />} />
                  <Bar
                    dataKey="request_count"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live Agent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Live Agent Activity</CardTitle>
          <CardDescription>
            Agent status and usage over the last 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : !hasAgentData ? (
            <EmptyState message="No data yet. Connect an SDK to get started." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Last Model</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="text-right">Cost (24h)</TableHead>
                  <TableHead className="text-right">Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentSummaries.map((agent) => (
                  <TableRow key={agent.agent_name}>
                    <TableCell>
                      <span
                        className={`inline-block size-2 rounded-full ${
                          agent.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                        }`}
                        title={agent.is_active ? 'Active' : 'Idle'}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {agent.agent_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{agent.last_model}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(agent.request_count)}
                    </TableCell>
                    <TableCell className="text-right">
                      {agent.error_count > 0 ? (
                        <span className="text-red-500">
                          {formatNumber(agent.error_count)}
                        </span>
                      ) : (
                        '0'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCost(agent.total_cost)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatRelativeTime(agent.last_active)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Data fetch error banner */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load some dashboard data. Retrying automatically.
        </div>
      )}
    </>
  );
}
