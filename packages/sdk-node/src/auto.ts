/**
 * Zero-code auto-instrumentation for AgentBeam (Node.js / TypeScript).
 *
 * Usage (pick one):
 *
 *   node --require agentbeam/auto app.js
 *
 *   NODE_OPTIONS='--require agentbeam/auto' node app.js
 *
 *   # In package.json:
 *   "start": "node --require agentbeam/auto server.js"
 *
 *   # For Next.js / frameworks, add to .env:
 *   NODE_OPTIONS=--require agentbeam/auto
 *   AGENTBEAM_API_KEY=ab_xxx
 *
 * Environment variables:
 *   AGENTBEAM_API_KEY       (required) — your AgentBeam API key
 *   AGENTBEAM_API_URL       (optional) — API endpoint, defaults to https://agentbeam.agentbeamai.workers.dev/api/v1
 *   AGENTBEAM_AGENT_NAME    (optional) — agent name, defaults to 'default'
 *   AGENTBEAM_AGENT_VERSION (optional) — agent version string
 *   AGENTBEAM_ENVIRONMENT   (optional) — environment tag, defaults to 'production'
 *   AGENTBEAM_DEBUG         (optional) — set to '1' to enable debug logging
 */

import { randomUUID } from 'node:crypto';
import { AgentBeamClient } from './client';
import type { SpanData } from './types';

const apiKey = process.env.AGENTBEAM_API_KEY;
const debug = process.env.AGENTBEAM_DEBUG === '1';

function log(...args: unknown[]): void {
  if (debug) {
    console.log('[AgentBeam]', ...args);
  }
}

if (!apiKey) {
  if (debug) {
    console.warn(
      '[AgentBeam] AGENTBEAM_API_KEY not set — auto-instrumentation disabled.',
    );
  }
} else {
  const client = new AgentBeamClient({
    apiKey,
    apiUrl:
      process.env.AGENTBEAM_API_URL ||
      'https://agentbeam.agentbeamai.workers.dev/api/v1',
    agentName: process.env.AGENTBEAM_AGENT_NAME || 'default',
    agentVersion: process.env.AGENTBEAM_AGENT_VERSION,
    environment: (process.env.AGENTBEAM_ENVIRONMENT as 'production' | 'staging' | 'development') || 'production',
  });

  let patchedCount = 0;

  // -------------------------------------------------------------------------
  // Patch Anthropic SDK (prototype-level)
  // -------------------------------------------------------------------------
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const anthropicModule = require('@anthropic-ai/sdk');

    // The Anthropic SDK exports its Messages resource class that we need to patch.
    // Depending on the version, Messages may live in different places.
    // We look for the class whose prototype has a `create` method.
    const AnthropicClass =
      anthropicModule.default || anthropicModule.Anthropic || anthropicModule;

    // The Messages resource is typically at Anthropic.prototype.messages, but
    // the `messages` getter returns a new instance each time. Instead, we need
    // to patch the Messages class prototype directly.
    //
    // Strategy: require the resources sub-module where the Messages class lives.
    let MessagesProto: Record<string, unknown> | null = null;

    try {
      // Modern Anthropic SDK (>= 0.20) exports resources
      const resources = require('@anthropic-ai/sdk/resources');
      if (resources.Messages?.prototype?.create) {
        MessagesProto = resources.Messages.prototype;
      }
    } catch {
      // Fallback: try to find it via the main module
    }

    if (!MessagesProto) {
      // Try accessing from the class itself
      // In some SDK versions, `Anthropic.Messages` is the class
      const candidates = [
        AnthropicClass?.Messages?.prototype,
        AnthropicClass?.prototype?.messages?.constructor?.prototype,
      ];
      for (const candidate of candidates) {
        if (candidate && typeof candidate.create === 'function') {
          MessagesProto = candidate;
          break;
        }
      }
    }

    if (!MessagesProto) {
      // Last resort: create a temporary instance to discover the prototype
      try {
        const tmpClient = new AnthropicClass({ apiKey: 'probe' });
        if (tmpClient.messages && typeof tmpClient.messages.create === 'function') {
          MessagesProto = Object.getPrototypeOf(tmpClient.messages);
        }
      } catch {
        // Cannot probe, skip
      }
    }

    if (MessagesProto && typeof MessagesProto.create === 'function') {
      const originalCreate = MessagesProto.create as (...args: unknown[]) => unknown;

      MessagesProto.create = function patchedAnthropicCreate(
        this: unknown,
        ...args: unknown[]
      ): unknown {
        const params = (args[0] ?? {}) as Record<string, unknown>;
        const startedAt = new Date();
        const traceId = randomUUID();
        const spanId = randomUUID();

        // Build input preview
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

        const result = originalCreate.apply(this, args);

        if (result && typeof (result as { then?: unknown }).then === 'function') {
          return (result as Promise<unknown>).then(
            (response) => {
              recordAnthropicSpan(client, response, {
                traceId,
                spanId,
                startedAt,
                modelName,
                inputPreview,
              });
              return response;
            },
            (err: unknown) => {
              recordErrorSpan(client, err, {
                traceId,
                spanId,
                startedAt,
                modelName,
                inputPreview,
                spanName: 'anthropic.messages.create',
                provider: 'anthropic',
              });
              throw err;
            },
          );
        }

        recordAnthropicSpan(client, result, {
          traceId,
          spanId,
          startedAt,
          modelName,
          inputPreview,
        });
        return result;
      };

      patchedCount++;
      log('Patched @anthropic-ai/sdk Messages.create');
    } else {
      log('Could not locate Anthropic Messages.create prototype — skipping');
    }
  } catch (e) {
    log('Anthropic SDK not available:', (e as Error).message);
  }

  // -------------------------------------------------------------------------
  // Patch OpenAI SDK (prototype-level)
  // -------------------------------------------------------------------------
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const openaiModule = require('openai');
    const OpenAIClass =
      openaiModule.default || openaiModule.OpenAI || openaiModule;

    // Similar strategy: find the Completions class prototype
    let CompletionsProto: Record<string, unknown> | null = null;

    try {
      const resources = require('openai/resources');
      // OpenAI SDK v4+ uses resources.Chat.Completions
      if (resources.Chat?.Completions?.prototype?.create) {
        CompletionsProto = resources.Chat.Completions.prototype;
      } else if (resources.Completions?.prototype?.create) {
        CompletionsProto = resources.Completions.prototype;
      }
    } catch {
      // Fallback
    }

    if (!CompletionsProto) {
      try {
        const chatResources = require('openai/resources/chat');
        if (chatResources.Completions?.prototype?.create) {
          CompletionsProto = chatResources.Completions.prototype;
        }
      } catch {
        // Fallback
      }
    }

    if (!CompletionsProto) {
      // Try via a temporary instance
      try {
        const tmpClient = new OpenAIClass({ apiKey: 'probe' });
        if (
          tmpClient.chat?.completions &&
          typeof tmpClient.chat.completions.create === 'function'
        ) {
          CompletionsProto = Object.getPrototypeOf(tmpClient.chat.completions);
        }
      } catch {
        // Cannot probe, skip
      }
    }

    if (CompletionsProto && typeof CompletionsProto.create === 'function') {
      const originalCreate = CompletionsProto.create as (...args: unknown[]) => unknown;

      CompletionsProto.create = function patchedOpenAICreate(
        this: unknown,
        ...args: unknown[]
      ): unknown {
        const params = (args[0] ?? {}) as Record<string, unknown>;
        const startedAt = new Date();
        const traceId = randomUUID();
        const spanId = randomUUID();

        // Build input preview
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

        const result = originalCreate.apply(this, args);

        if (result && typeof (result as { then?: unknown }).then === 'function') {
          return (result as Promise<unknown>).then(
            (response) => {
              recordOpenAISpan(client, response, {
                traceId,
                spanId,
                startedAt,
                modelName,
                inputPreview,
              });
              return response;
            },
            (err: unknown) => {
              recordErrorSpan(client, err, {
                traceId,
                spanId,
                startedAt,
                modelName,
                inputPreview,
                spanName: 'openai.chat.completions.create',
                provider: 'openai',
              });
              throw err;
            },
          );
        }

        recordOpenAISpan(client, result, {
          traceId,
          spanId,
          startedAt,
          modelName,
          inputPreview,
        });
        return result;
      };

      patchedCount++;
      log('Patched openai Chat.Completions.create');
    } else {
      log('Could not locate OpenAI Completions.create prototype — skipping');
    }
  } catch (e) {
    log('OpenAI SDK not available:', (e as Error).message);
  }

  // -------------------------------------------------------------------------
  // Graceful shutdown
  // -------------------------------------------------------------------------
  const shutdownHandler = () => {
    client.shutdown().catch(() => {});
  };

  process.on('SIGINT', shutdownHandler);
  process.on('SIGTERM', shutdownHandler);

  if (patchedCount > 0) {
    console.log(
      `[AgentBeam] Auto-instrumentation active (${patchedCount} SDK${patchedCount > 1 ? 's' : ''} patched)`,
    );
  } else {
    console.log(
      '[AgentBeam] Auto-instrumentation active (no supported SDKs detected yet — they will be patched if loaded later)',
    );

    // Hook into Module._load to catch SDKs loaded after this file.
    // This handles the case where agentbeam/auto is required before the
    // user's code imports @anthropic-ai/sdk or openai.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Module = require('module');
      const originalLoad = Module._load;

      Module._load = function patchedLoad(
        request: string,
        parent: unknown,
        isMain: boolean,
      ): unknown {
        const result = originalLoad.call(this, request, parent, isMain);

        if (request === '@anthropic-ai/sdk' && !_anthropicPatched) {
          patchAnthropicLazy(client, result);
        } else if (request === 'openai' && !_openaiPatched) {
          patchOpenAILazy(client, result);
        }

        return result;
      };

      log('Module._load hook installed for lazy SDK patching');
    } catch {
      log('Could not install Module._load hook');
    }
  }
}

// ---------------------------------------------------------------------------
// Lazy patching (for SDKs loaded after auto.ts)
// ---------------------------------------------------------------------------

let _anthropicPatched = false;
let _openaiPatched = false;

function patchAnthropicLazy(
  client: AgentBeamClient,
  anthropicModule: Record<string, unknown>,
): void {
  _anthropicPatched = true;

  try {
    const AnthropicClass =
      (anthropicModule.default as Record<string, unknown>) ||
      (anthropicModule.Anthropic as Record<string, unknown>) ||
      anthropicModule;

    // Try to find Messages prototype
    let MessagesProto: Record<string, unknown> | null = null;

    try {
      const Ctor = AnthropicClass as unknown as new (opts: unknown) => Record<string, unknown>;
      const tmpClient = new Ctor({ apiKey: 'probe' });
      if (
        tmpClient.messages &&
        typeof (tmpClient.messages as Record<string, unknown>).create === 'function'
      ) {
        MessagesProto = Object.getPrototypeOf(tmpClient.messages) as Record<string, unknown>;
      }
    } catch {
      // Skip
    }

    if (MessagesProto && typeof MessagesProto.create === 'function') {
      const originalCreate = MessagesProto.create as (...args: unknown[]) => unknown;

      MessagesProto.create = function patchedAnthropicCreate(
        this: unknown,
        ...args: unknown[]
      ): unknown {
        const params = (args[0] ?? {}) as Record<string, unknown>;
        const startedAt = new Date();
        const traceId = randomUUID();
        const spanId = randomUUID();

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
        const result = originalCreate.apply(this, args);

        if (result && typeof (result as { then?: unknown }).then === 'function') {
          return (result as Promise<unknown>).then(
            (response) => {
              recordAnthropicSpan(client, response, {
                traceId,
                spanId,
                startedAt,
                modelName,
                inputPreview,
              });
              return response;
            },
            (err: unknown) => {
              recordErrorSpan(client, err, {
                traceId,
                spanId,
                startedAt,
                modelName,
                inputPreview,
                spanName: 'anthropic.messages.create',
                provider: 'anthropic',
              });
              throw err;
            },
          );
        }

        recordAnthropicSpan(client, result, {
          traceId,
          spanId,
          startedAt,
          modelName,
          inputPreview,
        });
        return result;
      };

      log('Lazy-patched @anthropic-ai/sdk Messages.create');
    }
  } catch (e) {
    log('Failed to lazy-patch Anthropic:', (e as Error).message);
  }
}

function patchOpenAILazy(
  client: AgentBeamClient,
  openaiModule: Record<string, unknown>,
): void {
  _openaiPatched = true;

  try {
    const OpenAIClass =
      (openaiModule.default as Record<string, unknown>) ||
      (openaiModule.OpenAI as Record<string, unknown>) ||
      openaiModule;

    let CompletionsProto: Record<string, unknown> | null = null;

    try {
      const Ctor = OpenAIClass as unknown as new (opts: unknown) => Record<string, unknown>;
      const tmpClient = new Ctor({ apiKey: 'probe' });
      if (
        tmpClient.chat &&
        (tmpClient.chat as Record<string, unknown>).completions &&
        typeof (
          (tmpClient.chat as Record<string, unknown>).completions as Record<
            string,
            unknown
          >
        ).create === 'function'
      ) {
        CompletionsProto = Object.getPrototypeOf(
          (tmpClient.chat as Record<string, unknown>).completions,
        ) as Record<string, unknown>;
      }
    } catch {
      // Skip
    }

    if (CompletionsProto && typeof CompletionsProto.create === 'function') {
      const originalCreate = CompletionsProto.create as (...args: unknown[]) => unknown;

      CompletionsProto.create = function patchedOpenAICreate(
        this: unknown,
        ...args: unknown[]
      ): unknown {
        const params = (args[0] ?? {}) as Record<string, unknown>;
        const startedAt = new Date();
        const traceId = randomUUID();
        const spanId = randomUUID();

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
        const result = originalCreate.apply(this, args);

        if (result && typeof (result as { then?: unknown }).then === 'function') {
          return (result as Promise<unknown>).then(
            (response) => {
              recordOpenAISpan(client, response, {
                traceId,
                spanId,
                startedAt,
                modelName,
                inputPreview,
              });
              return response;
            },
            (err: unknown) => {
              recordErrorSpan(client, err, {
                traceId,
                spanId,
                startedAt,
                modelName,
                inputPreview,
                spanName: 'openai.chat.completions.create',
                provider: 'openai',
              });
              throw err;
            },
          );
        }

        recordOpenAISpan(client, result, {
          traceId,
          spanId,
          startedAt,
          modelName,
          inputPreview,
        });
        return result;
      };

      log('Lazy-patched openai Chat.Completions.create');
    }
  } catch (e) {
    log('Failed to lazy-patch OpenAI:', (e as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Span recording helpers
// ---------------------------------------------------------------------------

interface SpanContext {
  traceId: string;
  spanId: string;
  startedAt: Date;
  modelName: string;
  inputPreview: string;
}

interface ErrorSpanContext extends SpanContext {
  spanName: string;
  provider: string;
}

function recordAnthropicSpan(
  ab: AgentBeamClient,
  response: unknown,
  ctx: SpanContext,
): void {
  const endedAt = new Date();
  const res = response as Record<string, unknown> | null | undefined;

  const usage = res?.usage as
    | { input_tokens?: number; output_tokens?: number }
    | undefined;

  let outputPreview = '';
  const content = res?.content as
    | Array<{ type: string; text?: string }>
    | undefined;
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

function recordOpenAISpan(
  ab: AgentBeamClient,
  response: unknown,
  ctx: SpanContext,
): void {
  const endedAt = new Date();
  const res = response as Record<string, unknown> | null | undefined;

  const usage = res?.usage as
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      }
    | undefined;

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
  ctx: ErrorSpanContext,
): void {
  const endedAt = new Date();

  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorType = err instanceof Error ? err.constructor.name : 'UnknownError';

  const span: SpanData = {
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
    span_name: ctx.spanName,
    span_kind: 'llm',
    status: 'error',
    model_provider: ctx.provider,
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
