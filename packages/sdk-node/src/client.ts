import { AgentBeamConfig, SpanData, IngestPayload } from './types';
import { wrapAnthropic } from './instruments/anthropic';
import { wrapOpenAI } from './instruments/openai';

const SDK_VERSION = '0.1.0';
const DEFAULT_API_URL = 'https://app.agentbeam.ai';
const DEFAULT_FLUSH_INTERVAL = 5_000;
const DEFAULT_MAX_BATCH_SIZE = 100;

export class AgentBeamClient {
  readonly apiKey: string;
  readonly apiUrl: string;
  readonly environment: string;
  readonly agentName?: string;
  readonly agentVersion?: string;
  readonly maxBatchSize: number;

  private _buffer: SpanData[] = [];
  private _timer: ReturnType<typeof setInterval> | null = null;
  private _flushing = false;
  private _shutdown = false;

  constructor(config: AgentBeamConfig) {
    if (!config.apiKey) {
      throw new Error('AgentBeam: apiKey is required');
    }

    this.apiKey = config.apiKey;
    this.apiUrl = (config.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
    this.environment = config.environment ?? 'production';
    this.agentName = config.agentName;
    this.agentVersion = config.agentVersion;
    this.maxBatchSize = config.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;

    const interval = config.flushInterval ?? DEFAULT_FLUSH_INTERVAL;
    this._timer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[AgentBeam] flush error:', err);
      });
    }, interval);

    // Unref so the timer doesn't prevent process exit
    if (this._timer && typeof this._timer === 'object' && 'unref' in this._timer) {
      this._timer.unref();
    }

    // Flush remaining spans before the process exits
    process.on('beforeExit', () => {
      if (!this._shutdown) {
        this.shutdown().catch(() => {});
      }
    });
  }

  // ---------------------------------------------------------------------------
  // wrap() — auto-instrument an Anthropic or OpenAI client
  // ---------------------------------------------------------------------------

  wrap<T>(client: T): T {
    if (this._isAnthropic(client)) {
      return wrapAnthropic(client, this);
    }
    if (this._isOpenAI(client)) {
      return wrapOpenAI(client, this);
    }
    throw new Error(
      'AgentBeam: wrap() only supports Anthropic and OpenAI clients. ' +
      'Use startSpan() for manual instrumentation.',
    );
  }

  // ---------------------------------------------------------------------------
  // Span buffer
  // ---------------------------------------------------------------------------

  /** Enqueue a completed span for the next flush. */
  addSpan(span: SpanData): void {
    if (this._shutdown) return;

    // Apply defaults from config
    if (!span.agent_name && this.agentName) span.agent_name = this.agentName;
    if (!span.agent_version && this.agentVersion) span.agent_version = this.agentVersion;
    if (!span.environment) span.environment = this.environment;

    this._buffer.push(span);

    // Flush immediately if we hit the batch ceiling
    if (this._buffer.length >= this.maxBatchSize) {
      this.flush().catch((err) => {
        console.error('[AgentBeam] flush error:', err);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Flush
  // ---------------------------------------------------------------------------

  async flush(): Promise<void> {
    if (this._flushing || this._buffer.length === 0) return;
    this._flushing = true;

    // Drain the buffer (take up to maxBatchSize)
    const batch = this._buffer.splice(0, this.maxBatchSize);

    const payload: IngestPayload = {
      spans: batch,
      sdk_version: SDK_VERSION,
      sdk_language: 'typescript',
    };

    try {
      const res = await fetch(`${this.apiUrl}/api/v1/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AgentBeam-Key': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[AgentBeam] ingest failed (${res.status}): ${text}`);
        // Put the spans back so they can be retried
        this._buffer.unshift(...batch);
      }
    } catch (err) {
      console.error('[AgentBeam] ingest error:', err);
      // Put the spans back so they can be retried
      this._buffer.unshift(...batch);
    } finally {
      this._flushing = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Shutdown
  // ---------------------------------------------------------------------------

  async shutdown(): Promise<void> {
    this._shutdown = true;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    // Flush any remaining spans
    while (this._buffer.length > 0) {
      await this.flush();
    }
  }

  // ---------------------------------------------------------------------------
  // Client detection helpers
  // ---------------------------------------------------------------------------

  private _isAnthropic(client: unknown): boolean {
    if (!client || typeof client !== 'object') return false;
    const c = client as Record<string, unknown>;
    // Anthropic SDK exposes a `messages` namespace with a `create` method
    return (
      typeof c.messages === 'object' &&
      c.messages !== null &&
      typeof (c.messages as Record<string, unknown>).create === 'function'
    );
  }

  private _isOpenAI(client: unknown): boolean {
    if (!client || typeof client !== 'object') return false;
    const c = client as Record<string, unknown>;
    // OpenAI SDK exposes chat.completions.create
    return (
      typeof c.chat === 'object' &&
      c.chat !== null &&
      typeof (c.chat as Record<string, unknown>).completions === 'object' &&
      (c.chat as Record<string, unknown>).completions !== null &&
      typeof (
        (c.chat as Record<string, unknown>).completions as Record<string, unknown>
      ).create === 'function'
    );
  }
}
