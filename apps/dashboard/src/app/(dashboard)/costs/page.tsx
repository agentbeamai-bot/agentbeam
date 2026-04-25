'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProjectContext } from '@/lib/project-context';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  DollarSignIcon,
  TrendingUpIcon,
  TargetIcon,
  LightbulbIcon,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatTokens, formatNumber } from '@/lib/utils/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Period = '7d' | '30d' | '90d';

interface HourRow {
  hour: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  request_count: number;
  error_count: number;
}

interface ModelHourRow {
  model_name: string;
  model_provider: string;
  hour: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  request_count: number;
  error_count: number;
}

interface ModelRow {
  model_name: string;
  model_provider: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  request_count: number;
  error_count: number;
}

interface AgentModelRow {
  agent_name: string;
  model_name: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  request_count: number;
  error_count: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 };

const MODEL_COLORS = [
  'var(--chart-1, #2563eb)',
  'var(--chart-2, #7c3aed)',
  'var(--chart-3, #db2777)',
  'var(--chart-4, #ea580c)',
  'var(--chart-5, #16a34a)',
  'var(--chart-6, #0891b2)',
  'var(--chart-7, #ca8a04)',
  'var(--chart-8, #dc2626)',
];

const OPTIMIZATION_SUGGESTIONS = [
  {
    title: 'Use smaller models for simple tasks',
    description:
      'Consider using a smaller, cheaper model for simple classification or extraction tasks where a frontier model is overkill.',
  },
  {
    title: 'Enable prompt caching',
    description:
      'Repeated system prompts and few-shot examples can be cached to reduce input token costs by up to 90%.',
  },
  {
    title: 'Set up budget alerts',
    description:
      'Configure budget thresholds and alerts on the Settings page to avoid unexpected spend.',
  },
];

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

function periodRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - PERIOD_DAYS[period]);
  return { from: from.toISOString(), to: now.toISOString() };
}

async function fetchCosts<T>(
  groupBy: string,
  period: Period,
  projectId: string,
): Promise<{ group_by: string; data: T[] }> {
  const { from, to } = periodRange(period);
  const params = new URLSearchParams({
    group_by: groupBy,
    from,
    to,
    project_id: projectId,
  });
  const res = await fetch(`/api/v1/costs?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch costs (${groupBy})`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CostsPage() {
  const { projectId } = useProjectContext();
  const [period, setPeriod] = useState<Period>('30d');

  // Fetch all groupings in parallel
  const hourQuery = useQuery({
    queryKey: ['costs', 'hour', period, projectId],
    queryFn: () => fetchCosts<HourRow>('hour', period, projectId!),
    enabled: !!projectId,
  });

  const modelHourQuery = useQuery({
    queryKey: ['costs', 'model_hour', period, projectId],
    queryFn: () => fetchCosts<ModelHourRow>('model_hour', period, projectId!),
    enabled: !!projectId,
  });

  const modelQuery = useQuery({
    queryKey: ['costs', 'model', period, projectId],
    queryFn: () => fetchCosts<ModelRow>('model', period, projectId!),
    enabled: !!projectId,
  });

  const agentModelQuery = useQuery({
    queryKey: ['costs', 'agent_model', period, projectId],
    queryFn: () => fetchCosts<AgentModelRow>('agent_model', period, projectId!),
    enabled: !!projectId,
  });

  const isLoading =
    hourQuery.isLoading ||
    modelHourQuery.isLoading ||
    modelQuery.isLoading ||
    agentModelQuery.isLoading;

  const isEmpty =
    !isLoading &&
    (!hourQuery.data?.data.length) &&
    (!modelQuery.data?.data.length);

  // ---- Derived data ----

  const totalSpend = useMemo(() => {
    if (!hourQuery.data?.data) return 0;
    return hourQuery.data.data.reduce((sum, r) => sum + r.total_cost, 0);
  }, [hourQuery.data]);

  const forecast = useMemo(() => {
    if (!hourQuery.data?.data || hourQuery.data.data.length === 0) return 0;
    const days = PERIOD_DAYS[period];
    const dailyAvg = totalSpend / days;
    const now = new Date();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const dayOfMonth = now.getDate();
    const remaining = daysInMonth - dayOfMonth;
    // Spend so far this month + projected remaining
    return totalSpend + dailyAvg * remaining;
  }, [totalSpend, hourQuery.data, period]);

  // Stacked area chart data: pivot model_hour rows into {hour, model1: cost, model2: cost, ...}
  const { areaChartData, modelNames } = useMemo(() => {
    if (!modelHourQuery.data?.data)
      return { areaChartData: [], modelNames: [] as string[] };

    const rows = modelHourQuery.data.data;
    const models = [...new Set(rows.map((r) => r.model_name))];
    const byHour = new Map<string, Record<string, number>>();

    for (const row of rows) {
      const dateKey = new Date(row.hour).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (!byHour.has(dateKey)) {
        byHour.set(dateKey, { date: 0 } as unknown as Record<string, number>);
      }
      const entry = byHour.get(dateKey)!;
      entry[row.model_name] =
        (entry[row.model_name] ?? 0) + row.total_cost;
    }

    const chartData = Array.from(byHour.entries()).map(([dateKey, costs]) => ({
      date: dateKey,
      ...costs,
    }));

    return { areaChartData: chartData, modelNames: models };
  }, [modelHourQuery.data]);

  // Agent bar chart data: pivot agent_model rows into {agent, model1: cost, model2: cost, ...}
  const { agentChartData, agentModelNames, agentTotalCost } = useMemo(() => {
    if (!agentModelQuery.data?.data)
      return {
        agentChartData: [],
        agentModelNames: [] as string[],
        agentTotalCost: 0,
      };

    const rows = agentModelQuery.data.data;
    const models = [...new Set(rows.map((r) => r.model_name))];
    const byAgent = new Map<string, Record<string, number>>();
    let total = 0;

    for (const row of rows) {
      if (!byAgent.has(row.agent_name)) {
        byAgent.set(row.agent_name, {});
      }
      const entry = byAgent.get(row.agent_name)!;
      entry[row.model_name] =
        (entry[row.model_name] ?? 0) + row.total_cost;
      total += row.total_cost;
    }

    const chartData = Array.from(byAgent.entries())
      .map(([agent, costs]) => {
        const agentTotal = Object.values(costs).reduce((s, c) => s + c, 0);
        return {
          agent,
          ...costs,
          _total: agentTotal,
          _pct: total > 0 ? (agentTotal / total) * 100 : 0,
        };
      })
      .sort((a, b) => b._total - a._total);

    return { agentChartData: chartData, agentModelNames: models, agentTotalCost: total };
  }, [agentModelQuery.data]);

  // Model table data (already sorted by cost from API)
  const modelTableData = useMemo(() => {
    if (!modelQuery.data?.data) return [];
    return modelQuery.data.data.map((m) => ({
      ...m,
      avgCost: m.request_count > 0 ? m.total_cost / m.request_count : 0,
    }));
  }, [modelQuery.data]);

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Costs</h1>
          <p className="text-muted-foreground">
            Track spending across models, agents, and time periods.
          </p>
        </div>
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p === '7d' ? 'Last 7d' : p === '30d' ? 'Last 30d' : 'Last 90d'}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Spend
            </CardTitle>
            <DollarSignIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalSpend)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last {PERIOD_DAYS[period]} days
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Budget Usage
            </CardTitle>
            <TargetIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">
                  No budget set
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure in Settings
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Month-End Forecast
            </CardTitle>
            <TrendingUpIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {isEmpty ? '--' : formatCurrency(forecast)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on current daily average
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <Card>
          <CardContent className="flex h-[300px] items-center justify-center">
            <div className="text-center text-muted-foreground">
              <DollarSignIcon className="mx-auto mb-3 size-10 opacity-50" />
              <p className="font-medium">No cost data available</p>
              <p className="mt-1 text-sm">
                Costs are calculated automatically from ingested traces.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts row */}
      {!isEmpty && (
        <div className="grid gap-4 lg:grid-cols-7">
          {/* Cost Over Time — stacked area */}
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Cost Over Time</CardTitle>
              <CardDescription>
                Daily spend broken down by model.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {modelHourQuery.isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : areaChartData.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  No time-series data for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={areaChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v: number) => formatCurrency(v)}
                      className="fill-muted-foreground"
                      width={70}
                    />
                    <RechartsTooltip
                      formatter={(value, name) => [
                        formatCurrency(Number(value ?? 0)),
                        String(name),
                      ]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                    {modelNames.map((model, i) => (
                      <Area
                        key={model}
                        type="monotone"
                        dataKey={model}
                        stackId="1"
                        fill={MODEL_COLORS[i % MODEL_COLORS.length]}
                        stroke={MODEL_COLORS[i % MODEL_COLORS.length]}
                        fillOpacity={0.4}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Cost by Agent — horizontal bar */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Cost by Agent</CardTitle>
              <CardDescription>
                Total spend per agent, segmented by model.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agentModelQuery.isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : agentChartData.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  No agent data for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={agentChartData}
                    layout="vertical"
                    margin={{ left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v: number) => formatCurrency(v)}
                      className="fill-muted-foreground"
                    />
                    <YAxis
                      type="category"
                      dataKey="agent"
                      tick={{ fontSize: 12 }}
                      width={100}
                      className="fill-muted-foreground"
                    />
                    <RechartsTooltip
                      formatter={(value, name) => [
                        formatCurrency(Number(value ?? 0)),
                        String(name),
                      ]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                    {agentModelNames.map((model, i) => (
                      <Bar
                        key={model}
                        dataKey={model}
                        stackId="a"
                        fill={MODEL_COLORS[i % MODEL_COLORS.length]}
                        radius={
                          i === agentModelNames.length - 1
                            ? [0, 4, 4, 0]
                            : undefined
                        }
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
              {/* Percentage labels */}
              {agentChartData.length > 0 && (
                <div className="mt-3 space-y-1">
                  {agentChartData.map((row) => (
                    <div
                      key={row.agent}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span>{row.agent}</span>
                      <span>
                        {formatCurrency(row._total)} ({row._pct.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cost by Model table */}
      {!isEmpty && (
        <Card>
          <CardHeader>
            <CardTitle>Cost by Model</CardTitle>
            <CardDescription>
              Detailed breakdown of spend and token usage per model.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {modelQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : modelTableData.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                No model data for this period.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Input Tokens</TableHead>
                    <TableHead className="text-right">Output Tokens</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Avg Cost/Req</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelTableData.map((row) => (
                    <TableRow key={row.model_name}>
                      <TableCell className="font-medium">
                        {row.model_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {row.model_provider}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(row.total_cost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTokens(row.total_input_tokens)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTokens(row.total_output_tokens)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.request_count)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.avgCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Optimization Suggestions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LightbulbIcon className="size-4 text-yellow-500" />
            <CardTitle>Optimization Suggestions</CardTitle>
          </div>
          <CardDescription>
            Tips to reduce costs without sacrificing quality.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {OPTIMIZATION_SUGGESTIONS.map((suggestion) => (
              <div
                key={suggestion.title}
                className="rounded-lg border border-border p-3"
              >
                <p className="text-sm font-medium">{suggestion.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {suggestion.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
