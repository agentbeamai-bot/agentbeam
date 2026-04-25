'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProjectContext } from '@/lib/project-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TraceDetail } from '@/components/traces/trace-detail';
import { cn } from '@/lib/utils';
import {
  SearchIcon,
  FilterIcon,
  ChevronDownIcon,
  Loader2Icon,
  InboxIcon,
} from 'lucide-react';
import type { Span } from '@/components/traces/trace-timeline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TracesResponse {
  traces: Span[];
  total: number;
  limit: number;
  offset: number;
}

interface Filters {
  search: string;
  status: string;
  agentName: string;
  modelName: string;
  timeRange: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TIME_RANGES: Record<string, { label: string; hours: number }> = {
  '1h': { label: 'Last 1 hour', hours: 1 },
  '6h': { label: 'Last 6 hours', hours: 6 },
  '24h': { label: 'Last 24 hours', hours: 24 },
  '7d': { label: 'Last 7 days', hours: 168 },
  '30d': { label: 'Last 30 days', hours: 720 },
};

const STATUS_OPTIONS = ['all', 'ok', 'error', 'timeout'] as const;

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function relativeTime(ts: string): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diff = now - then;

  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function truncateId(id: string): string {
  if (!id) return '';
  return id.length > 12 ? `${id.slice(0, 8)}...` : id;
}

function formatTokens(input: number, output: number): string {
  if (!input && !output) return '--';
  return `${input.toLocaleString()} / ${output.toLocaleString()}`;
}

function formatCost(cost: number): string {
  const n = Number(cost);
  if (!n || n === 0) return '--';
  if (n < 0.001) return '<$0.001';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '--';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

const STATUS_STYLES: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  error: 'bg-red-500/15 text-red-700 dark:text-red-400',
  timeout: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TracesPage() {
  const { projectId: contextProjectId } = useProjectContext();
  const projectId = contextProjectId ?? '';

  const [filters, setFilters] = useState<Filters>({
    search: '',
    status: 'all',
    agentName: 'all',
    modelName: 'all',
    timeRange: '24h',
  });
  const [offset, setOffset] = useState(0);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Debounced search -- we keep local search and only apply on query
  const [searchInput, setSearchInput] = useState('');

  const updateFilter = useCallback(
    (key: keyof Filters, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setOffset(0);
    },
    []
  );

  // Build query params for the API
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (projectId) params.set('project_id', projectId);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.agentName !== 'all')
      params.set('agent_name', filters.agentName);
    if (filters.modelName !== 'all')
      params.set('model_name', filters.modelName);

    const range = TIME_RANGES[filters.timeRange];
    if (range) {
      const from = new Date(Date.now() - range.hours * 3_600_000).toISOString();
      params.set('from', from);
    }

    params.set('limit', PAGE_SIZE.toString());
    params.set('offset', offset.toString());
    return params.toString();
  }, [projectId, filters, offset]);

  // Main traces query
  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
  } = useQuery<TracesResponse>({
    queryKey: ['traces', queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/v1/traces?${queryParams}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to fetch traces');
      }
      return res.json();
    },
    enabled: !!projectId,
  });

  // Derive unique agent names and model names from current result set for
  // filter dropdowns. In production this would be a separate endpoint.
  const traces = data?.traces ?? [];
  const total = data?.total ?? 0;

  const agentNames = useMemo(() => {
    const set = new Set<string>();
    for (const t of traces) {
      if (t.agent_name) set.add(t.agent_name);
    }
    return Array.from(set).sort();
  }, [traces]);

  const modelNames = useMemo(() => {
    const set = new Set<string>();
    for (const t of traces) {
      if (t.model_name) set.add(t.model_name);
    }
    return Array.from(set).sort();
  }, [traces]);

  // Client-side search filter (span_name, agent_name)
  const filteredTraces = useMemo(() => {
    if (!searchInput.trim()) return traces;
    const q = searchInput.toLowerCase();
    return traces.filter(
      (t) =>
        t.span_name?.toLowerCase().includes(q) ||
        t.agent_name?.toLowerCase().includes(q)
    );
  }, [traces, searchInput]);

  const hasMore = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;
  const pageNum = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function openTraceDetail(traceId: string) {
    setSelectedTraceId(traceId);
    setSheetOpen(true);
  }

  // ----- Render -----

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Traces</h1>
        <p className="text-muted-foreground">
          Inspect individual agent runs, LLM calls, and tool invocations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trace Explorer</CardTitle>
          <CardDescription>
            Search and filter traces across all your agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ---- Filter Bar ---- */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by span or agent name..."
                value={searchInput}
                onChange={(e) =>
                  setSearchInput((e.target as HTMLInputElement).value)
                }
                className="pl-8"
              />
            </div>

            {/* Status filter */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    <FilterIcon className="mr-1.5 size-3" />
                    Status:{' '}
                    {filters.status === 'all'
                      ? 'All'
                      : filters.status.charAt(0).toUpperCase() +
                        filters.status.slice(1)}
                    <ChevronDownIcon className="ml-1 size-3" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start">
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => updateFilter('status', s)}
                  >
                    {s === 'all'
                      ? 'All'
                      : s.charAt(0).toUpperCase() + s.slice(1)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Agent filter */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    Agent:{' '}
                    {filters.agentName === 'all' ? 'All' : filters.agentName}
                    <ChevronDownIcon className="ml-1 size-3" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => updateFilter('agentName', 'all')}
                >
                  All
                </DropdownMenuItem>
                {agentNames.map((name) => (
                  <DropdownMenuItem
                    key={name}
                    onClick={() => updateFilter('agentName', name)}
                  >
                    {name}
                  </DropdownMenuItem>
                ))}
                {agentNames.length === 0 && (
                  <div className="px-1.5 py-1 text-xs text-muted-foreground">
                    No agents found
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Model filter */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    Model:{' '}
                    {filters.modelName === 'all' ? 'All' : filters.modelName}
                    <ChevronDownIcon className="ml-1 size-3" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => updateFilter('modelName', 'all')}
                >
                  All
                </DropdownMenuItem>
                {modelNames.map((name) => (
                  <DropdownMenuItem
                    key={name}
                    onClick={() => updateFilter('modelName', name)}
                  >
                    {name}
                  </DropdownMenuItem>
                ))}
                {modelNames.length === 0 && (
                  <div className="px-1.5 py-1 text-xs text-muted-foreground">
                    No models found
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Time range */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    {TIME_RANGES[filters.timeRange]?.label ?? 'Time Range'}
                    <ChevronDownIcon className="ml-1 size-3" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {Object.entries(TIME_RANGES).map(([key, val]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => updateFilter('timeRange', key)}
                  >
                    {val.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Loading indicator */}
            {isFetching && (
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* ---- Content ---- */}
          {!projectId ? (
            <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-muted-foreground">
              <InboxIcon className="size-10 opacity-40" />
              <p className="text-sm">
                No project selected. Create one in{' '}
                <a href="/settings" className="text-primary underline underline-offset-2">Settings</a>.
              </p>
            </div>
          ) : isLoading ? (
            <TracesTableSkeleton />
          ) : queryError ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              Error loading traces:{' '}
              {queryError instanceof Error
                ? queryError.message
                : 'Unknown error'}
            </div>
          ) : filteredTraces.length === 0 ? (
            <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-muted-foreground">
              <InboxIcon className="size-10 opacity-40" />
              <p className="text-sm font-medium">No traces found</p>
              <p className="text-xs">
                {traces.length === 0
                  ? 'Run: pip install agentbeam then AGENTBEAM_API_KEY=your_key python -m agentbeam your_script.py'
                  : 'Try adjusting your filters or search query.'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trace ID</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Span</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTraces.map((trace) => (
                    <TableRow
                      key={trace.id}
                      className="cursor-pointer"
                      onClick={() => openTraceDetail(trace.trace_id)}
                    >
                      <TableCell>
                        <button
                          type="button"
                          className="font-mono text-xs text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTraceDetail(trace.trace_id);
                          }}
                        >
                          {truncateId(trace.trace_id)}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm">
                        {trace.agent_name ?? (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm font-medium">
                        {trace.span_name}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                            STATUS_STYLES[trace.status] ?? STATUS_STYLES.ok
                          )}
                        >
                          {trace.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {trace.model_name ?? '--'}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatTokens(trace.input_tokens, trace.output_tokens)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatCost(trace.cost_usd)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatDuration(trace.duration_ms)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {relativeTime(trace.started_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Showing {offset + 1}
                  {' - '}
                  {Math.min(offset + PAGE_SIZE, total)} of{' '}
                  {total.toLocaleString()} traces
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasPrev}
                    onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Page {pageNum} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasMore}
                    onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---- Trace Detail Sheet ---- */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-2xl"
        >
          <SheetHeader>
            <SheetTitle>Trace Detail</SheetTitle>
            <SheetDescription>
              Full span timeline and details for this trace.
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">
            {selectedTraceId && projectId && (
              <TraceDetail traceId={selectedTraceId} projectId={projectId} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
function TracesTableSkeleton() {
  return (
    <div className="space-y-3">
      {/* Header row skeleton */}
      <div className="flex gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Data row skeletons */}
      {Array.from({ length: 8 }).map((_, row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: 9 }).map((_, col) => (
            <Skeleton key={col} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
