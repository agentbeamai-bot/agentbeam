'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Span {
  id: string;
  trace_id: string;
  parent_span_id: string | null;
  span_name: string;
  span_kind: string;
  status: string;
  model_provider: string | null;
  model_name: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  input_preview: string | null;
  output_preview: string | null;
  error_message: string | null;
  error_type: string | null;
  metadata: Record<string, unknown>;
  agent_name: string | null;
  agent_version: string | null;
  environment: string | null;
}

interface SpanNode {
  span: Span;
  children: SpanNode[];
  depth: number;
}

interface TraceTimelineProps {
  spans: Span[];
  onSpanClick?: (span: Span) => void;
  selectedSpanId?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const KIND_COLORS: Record<string, string> = {
  llm: 'bg-blue-500',
  tool: 'bg-emerald-500',
  agent: 'bg-purple-500',
  chain: 'bg-amber-500',
  retrieval: 'bg-cyan-500',
  custom: 'bg-zinc-400',
};

const KIND_LABELS: Record<string, string> = {
  llm: 'LLM',
  tool: 'Tool',
  agent: 'Agent',
  chain: 'Chain',
  retrieval: 'Retrieval',
  custom: 'Custom',
};

const STATUS_COLORS: Record<string, string> = {
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  error: 'bg-red-500/15 text-red-700 dark:text-red-400',
  timeout: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
};

function buildTree(spans: Span[]): SpanNode[] {
  const spanMap = new Map<string, SpanNode>();
  const roots: SpanNode[] = [];

  for (const span of spans) {
    spanMap.set(span.id, { span, children: [], depth: 0 });
  }

  for (const span of spans) {
    const node = spanMap.get(span.id)!;
    if (span.parent_span_id && spanMap.has(span.parent_span_id)) {
      const parent = spanMap.get(span.parent_span_id)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function setDepth(node: SpanNode, depth: number) {
    node.depth = depth;
    // Sort children by start time
    node.children.sort(
      (a, b) =>
        new Date(a.span.started_at).getTime() -
        new Date(b.span.started_at).getTime()
    );
    for (const child of node.children) {
      setDepth(child, depth + 1);
    }
  }

  roots.sort(
    (a, b) =>
      new Date(a.span.started_at).getTime() -
      new Date(b.span.started_at).getTime()
  );
  for (const root of roots) {
    setDepth(root, 0);
  }

  return roots;
}

function flattenTree(nodes: SpanNode[]): SpanNode[] {
  const result: SpanNode[] = [];
  function walk(node: SpanNode) {
    result.push(node);
    for (const child of node.children) {
      walk(child);
    }
  }
  for (const root of nodes) {
    walk(root);
  }
  return result;
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '--';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatCost(cost: number): string {
  if (!cost || cost === 0) return '--';
  if (cost < 0.001) return '<$0.001';
  return `$${cost.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TraceTimeline({
  spans,
  onSpanClick,
  selectedSpanId,
}: TraceTimelineProps) {
  const { flatNodes, traceStart, traceDuration } = useMemo(() => {
    const tree = buildTree(spans);
    const flat = flattenTree(tree);

    if (flat.length === 0) {
      return { flatNodes: flat, traceStart: 0, traceDuration: 1 };
    }

    const start = Math.min(
      ...flat.map((n) => new Date(n.span.started_at).getTime())
    );
    const end = Math.max(
      ...flat.map((n) => {
        const e = n.span.ended_at
          ? new Date(n.span.ended_at).getTime()
          : new Date(n.span.started_at).getTime() + (n.span.duration_ms ?? 0);
        return e;
      })
    );

    return {
      flatNodes: flat,
      traceStart: start,
      traceDuration: Math.max(end - start, 1),
    };
  }, [spans]);

  if (flatNodes.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No spans found in this trace.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-0.5">
        {/* Header */}
        <div className="mb-2 flex items-center text-xs text-muted-foreground">
          <div className="w-[240px] shrink-0 px-2 font-medium">Span</div>
          <div className="flex-1 px-2 font-medium">Timeline</div>
          <div className="w-[80px] shrink-0 px-2 text-right font-medium">
            Duration
          </div>
        </div>

        {/* Rows */}
        {flatNodes.map((node) => {
          const spanStart = new Date(node.span.started_at).getTime();
          const spanDuration = node.span.duration_ms ?? 0;
          const leftPct = ((spanStart - traceStart) / traceDuration) * 100;
          const widthPct = Math.max(
            (spanDuration / traceDuration) * 100,
            0.5
          );
          const kindColor =
            KIND_COLORS[node.span.span_kind] ?? KIND_COLORS.custom;
          const isSelected = selectedSpanId === node.span.id;

          return (
            <Tooltip key={node.span.id}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/60',
                      isSelected && 'bg-muted ring-1 ring-ring/20'
                    )}
                    onClick={() => onSpanClick?.(node.span)}
                  />
                }
              >
                {/* Span label */}
                <div
                  className="w-[240px] shrink-0 truncate px-1 text-xs"
                  style={{ paddingLeft: `${node.depth * 16 + 4}px` }}
                >
                  <span
                    className={cn(
                      'mr-1.5 inline-block size-2 rounded-full',
                      kindColor
                    )}
                  />
                  <span className="font-medium">{node.span.span_name}</span>
                  {node.span.model_name && (
                    <span className="ml-1.5 text-muted-foreground">
                      {node.span.model_name}
                    </span>
                  )}
                </div>

                {/* Timeline bar */}
                <div className="relative flex-1 px-2">
                  <div className="h-5 w-full rounded-sm bg-muted/40">
                    <div
                      className={cn('h-full rounded-sm opacity-80', kindColor)}
                      style={{
                        marginLeft: `${leftPct}%`,
                        width: `${Math.min(widthPct, 100 - leftPct)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Duration */}
                <div className="w-[80px] shrink-0 px-2 text-right text-xs tabular-nums text-muted-foreground">
                  {formatDuration(node.span.duration_ms)}
                </div>
              </TooltipTrigger>

              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <div className="font-medium">{node.span.span_name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {KIND_LABELS[node.span.span_kind] ?? node.span.span_kind}
                    </Badge>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        STATUS_COLORS[node.span.status] ?? STATUS_COLORS.ok
                      )}
                    >
                      {node.span.status}
                    </span>
                  </div>
                  {node.span.model_name && (
                    <div className="text-xs text-muted-foreground">
                      Model: {node.span.model_name}
                    </div>
                  )}
                  {(node.span.input_tokens > 0 ||
                    node.span.output_tokens > 0) && (
                    <div className="text-xs text-muted-foreground">
                      Tokens: {node.span.input_tokens.toLocaleString()} in /{' '}
                      {node.span.output_tokens.toLocaleString()} out
                    </div>
                  )}
                  {node.span.cost_usd > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Cost: {formatCost(Number(node.span.cost_usd))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Duration: {formatDuration(node.span.duration_ms)}
                  </div>
                  {node.span.error_message && (
                    <div className="text-xs text-red-600 dark:text-red-400">
                      {node.span.error_message}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3 border-t pt-3 text-xs text-muted-foreground">
          {Object.entries(KIND_LABELS).map(([kind, label]) => (
            <div key={kind} className="flex items-center gap-1">
              <span
                className={cn(
                  'inline-block size-2 rounded-full',
                  KIND_COLORS[kind]
                )}
              />
              {label}
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
