import { randomUUID } from 'node:crypto';
import { AgentBeamClient } from '../client';
import { SpanData } from '../types';

/**
 * Wrap an Anthropic client so every `messages.create` call is automatically
 * traced and reported to AgentBeam.
 *
 * Uses `Proxy` so the returned value has the exact same type as the input --
 * callers retain full type safety and autocomplete.
 */
export function wrapAnthropic<T>(client: T, ab: AgentBeamClient): T {
  const raw = client as Record<string, unknown>;
  const originalMessages = raw.messages as Record<string, unknown>;
  const originalCreate = originalMessages.create as (...args: unknown[]) => unknown;

  // Proxy the `messages` namespace so we can intercept `create`
  const messagesProxy = new Proxy(originalMessages, {
    get(target, prop, receiver) {
      if (prop === 'create') {
        return function wrappedCreate(...args: unknown[]) {
          const params = (args[0] ?? {}) as Record<string, unknown>;
          const startedAt = new Date();
          const traceId = randomUUID();
          const spanId = randomUUID();

          // Build input preview from the messages array
          const inputMessages = params.messages as
            | Array<{ role: string; content: unknown }>
            | undefined;
          let inputPreview = '';
          if (inputMessages && Array.isArray(inputMessages)) {
            const last = inputMessages[inputMessages.length - 1];
            if (last) {
              inputPreview =
                typeof last.content === 'string'
                  ? last.content.slice(0, 4096)
                  : JSON.stringify(last.content).slice(0, 4096);
            }
          }

          const modelName = (params.model as string) ?? 'unknown';

          // Call the real method
          const result = originalCreate.apply(target, args);

          // Handle both Promise and non-Promise returns
          if (result && typeof (result as { then?: unknown }).then === 'function') {
            return (result as Promise<unknown>).then(
              (response) => {
                recordSpan(ab, response, {
                  traceId,
                  spanId,
                  startedAt,
                  modelName,
                  inputPreview,
                });
                return response;
              },
              (err: unknown) => {
                recordErrorSpan(ab, err, {
                  traceId,
                  spanId,
                  startedAt,
                  modelName,
                  inputPreview,
                });
                throw err;
              },
            );
          }

          // Synchronous return (unlikely but safe to handle)
          recordSpan(ab, result, {
            traceId,
            spanId,
            startedAt,
            modelName,
            inputPreview,
          });
          return result;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  // Proxy the top-level client to return our patched `messages`
  return new Proxy(client as object, {
    get(target, prop, receiver) {
      if (prop === 'messages') return messagesProxy;
      return Reflect.get(target, prop, receiver);
    },
  }) as T;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SpanContext {
  traceId: string;
  spanId: string;
  startedAt: Date;
  modelName: string;
  inputPreview: string;
}

function recordSpan(
  ab: AgentBeamClient,
  response: unknown,
  ctx: SpanContext,
): void {
  const endedAt = new Date();
  const res = response as Record<string, unknown> | null | undefined;

  const usage = res?.usage as
    | { input_tokens?: number; output_tokens?: number }
    | undefined;

  // Extract output preview from the first content block
  let outputPreview = '';
  const content = res?.content as Array<{ type: string; text?: string }> | undefined;
  if (content && Array.isArray(content) && content.length > 0) {
    const textBlock = content.find((b) => b.type === 'text');
    if (textBlock?.text) {
      outputPreview = textBlock.text.slice(0, 4096);
    }
  }

  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;

  const span: SpanData = {
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
    span_name: 'anthropic.messages.create',
    span_kind: 'llm',
    status: 'ok',
    model_provider: 'anthropic',
    model_name: (res?.model as string) ?? ctx.modelName,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    started_at: ctx.startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    duration_ms: endedAt.getTime() - ctx.startedAt.getTime(),
    input_preview: ctx.inputPreview,
    output_preview: outputPreview,
  };

  ab.addSpan(span);
}

function recordErrorSpan(
  ab: AgentBeamClient,
  err: unknown,
  ctx: SpanContext,
): void {
  const endedAt = new Date();

  const errorMessage =
    err instanceof Error ? err.message : String(err);
  const errorType =
    err instanceof Error ? err.constructor.name : 'UnknownError';

  const span: SpanData = {
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
    span_name: 'anthropic.messages.create',
    span_kind: 'llm',
    status: 'error',
    model_provider: 'anthropic',
    model_name: ctx.modelName,
    started_at: ctx.startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    duration_ms: endedAt.getTime() - ctx.startedAt.getTime(),
    input_preview: ctx.inputPreview,
    error_message: errorMessage,
    error_type: errorType,
  };

  ab.addSpan(span);
}
