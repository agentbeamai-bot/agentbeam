'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TraceTimeline, type Span } from './trace-timeline';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
  AlertCircleIcon,
  ClockIcon,
  CpuIcon,
  DollarSignIcon,
  LayersIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TraceDetailProps {
  traceId: string;
  projectId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '--';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatCost(cost: number): string {
  if (!cost || cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const STATUS_BADGE: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  ok: { variant: 'secondary', label: 'OK' },
  error: { variant: 'destructive', label: 'Error' },
  timeout: { variant: 'outline', label: 'Timeout' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TraceDetail({ traceId, projectId }: TraceDetailProps) {
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  const { data, isLoading, error } = useQuery<{
    trace_id: string;
    spans: Span[];
    span_count: number;
  }>({
    queryKey: ['trace-detail', traceId, projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/traces/${traceId}?project_id=${projectId}`
      );
      if (!res.ok) throw new Error('Failed to fetch trace detail');
      return res.json();
    },
    enabled: !!traceId && !!projectId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Failed to load trace details.
      </div>
    );
  }

  const spans = data.spans;

  // Compute summary stats from all spans
  const totalDuration = Math.max(
    ...spans.map((s) => s.duration_ms ?? 0)
  );
  const totalTokens = spans.reduce((sum, s) => sum + s.total_tokens, 0);
  const totalCost = spans.reduce((sum, s) => sum + Number(s.cost_usd), 0);
  const hasError = spans.some((s) => s.status === 'error');
  const rootSpan = spans[0];

  const stats = [
    {
      label: 'Spans',
      value: spans.length.toString(),
      icon: LayersIcon,
    },
    {
      label: 'Duration',
      value: formatDuration(totalDuration),
      icon: ClockIcon,
    },
    {
      label: 'Tokens',
      value: totalTokens.toLocaleString(),
      icon: CpuIcon,
    },
    {
      label: 'Cost',
      value: formatCost(totalCost),
      icon: DollarSignIcon,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {traceId}
          </span>
          {hasError && (
            <Badge variant="destructive">
              <AlertCircleIcon className="mr-1 size-3" />
              Error
            </Badge>
          )}
        </div>
        {rootSpan && (
          <div className="text-xs text-muted-foreground">
            {rootSpan.agent_name && (
              <span className="mr-3">Agent: {rootSpan.agent_name}</span>
            )}
            <span>Started: {formatTimestamp(rootSpan.started_at)}</span>
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border p-3"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <stat.icon className="size-3.5" />
              {stat.label}
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <Separator />

      {/* Timeline */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Span Timeline</h3>
        <TraceTimeline
          spans={spans}
          onSpanClick={setSelectedSpan}
          selectedSpanId={selectedSpan?.id ?? null}
        />
      </div>

      {/* Selected span detail */}
      {selectedSpan && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {selectedSpan.span_name}
              </h3>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedSpan(null)}
              >
                Deselect
              </button>
            </div>

            {/* Span metadata grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <span className="text-muted-foreground">Kind</span>
                <div className="font-medium capitalize">
                  {selectedSpan.span_kind}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <div>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      selectedSpan.status === 'ok' &&
                        'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                      selectedSpan.status === 'error' &&
                        'bg-red-500/15 text-red-700 dark:text-red-400',
                      selectedSpan.status === 'timeout' &&
                        'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    )}
                  >
                    {selectedSpan.status}
                  </span>
                </div>
              </div>
              {selectedSpan.model_name && (
                <div>
                  <span className="text-muted-foreground">Model</span>
                  <div className="font-medium">{selectedSpan.model_name}</div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Duration</span>
                <div className="font-medium tabular-nums">
                  {formatDuration(selectedSpan.duration_ms)}
                </div>
              </div>
              {(selectedSpan.input_tokens > 0 ||
                selectedSpan.output_tokens > 0) && (
                <>
                  <div>
                    <span className="text-muted-foreground">Input Tokens</span>
                    <div className="font-medium tabular-nums">
                      {selectedSpan.input_tokens.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Output Tokens</span>
                    <div className="font-medium tabular-nums">
                      {selectedSpan.output_tokens.toLocaleString()}
                    </div>
                  </div>
                </>
              )}
              {Number(selectedSpan.cost_usd) > 0 && (
                <div>
                  <span className="text-muted-foreground">Cost</span>
                  <div className="font-medium tabular-nums">
                    {formatCost(Number(selectedSpan.cost_usd))}
                  </div>
                </div>
              )}
            </div>

            {/* Error message */}
            {selectedSpan.error_message && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400">
                  <AlertCircleIcon className="size-3.5" />
                  {selectedSpan.error_type ?? 'Error'}
                </div>
                <pre className="whitespace-pre-wrap text-xs text-red-600 dark:text-red-300">
                  {selectedSpan.error_message}
                </pre>
              </div>
            )}

            {/* Input / Output tabs */}
            {(selectedSpan.input_preview || selectedSpan.output_preview) && (
              <Tabs defaultValue="input">
                <TabsList>
                  {selectedSpan.input_preview && (
                    <TabsTrigger value="input">Input</TabsTrigger>
                  )}
                  {selectedSpan.output_preview && (
                    <TabsTrigger value="output">Output</TabsTrigger>
                  )}
                </TabsList>
                {selectedSpan.input_preview && (
                  <TabsContent value="input">
                    <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                      {selectedSpan.input_preview}
                    </pre>
                  </TabsContent>
                )}
                {selectedSpan.output_preview && (
                  <TabsContent value="output">
                    <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                      {selectedSpan.output_preview}
                    </pre>
                  </TabsContent>
                )}
              </Tabs>
            )}

            {/* Metadata */}
            {selectedSpan.metadata &&
              Object.keys(selectedSpan.metadata).length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Metadata
                  </h4>
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(selectedSpan.metadata, null, 2)}
                  </pre>
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}
