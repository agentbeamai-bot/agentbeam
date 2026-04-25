import { randomUUID } from 'node:crypto';
import { AgentBeamClient } from '../client';
import { SpanData } from '../types';

/**
 * Wrap an OpenAI client so every `chat.completions.create` call is automatically
 * traced and reported to AgentBeam.
 *
 * Uses nested `Proxy` objects so the returned value has the exact same type as
 * the input -- callers retain full type safety and autocomplete.
 */
export function wrapOpenAI<T>(client: T, ab: AgentBeamClient): T {
  const raw = client as Record<string, unknown>;
  const originalChat = raw.chat as Record<string, unknown>;
  const originalCompletions = originalChat.completions as Record<string, unknown>;
  const originalCreate = originalCompletions.create as (...args: unknown[]) => unknown;

  // Proxy completions.create
  const completionsProxy = new Proxy(originalCompletions, {
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

  // Proxy chat to return our patched completions
  const chatProxy = new Proxy(originalChat, {
    get(target, prop, receiver) {
      if (prop === 'completions') return completionsProxy;
      return Reflect.get(target, prop, receiver);
    },
  });

  // Proxy the top-level client to return our patched chat
  return new Proxy(client as object, {
    get(target, prop, receiver) {
      if (prop === 'chat') return chatProxy;
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
    | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    | undefined;

  // Extract output preview from the first choice
  let outputPreview = '';
  const choices = res?.choices as
    | Array<{ message?: { content?: string } }>
    | undefined;
  if (choices && Array.isArray(choices) && choices.length > 0) {
    const content = choices[0]?.message?.content;
    if (content) {
      outputPreview = content.slice(0, 4096);
    }
  }

  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;

  const span: SpanData = {
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
    span_name: 'openai.chat.completions.create',
    span_kind: 'llm',
    status: 'ok',
    model_provider: 'openai',
    model_name: (res?.model as string) ?? ctx.modelName,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: usage?.total_tokens ?? inputTokens + outputTokens,
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
    span_name: 'openai.chat.completions.create',
    span_kind: 'llm',
    status: 'error',
    model_provider: 'openai',
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
