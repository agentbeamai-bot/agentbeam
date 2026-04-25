export interface ModelPricing {
  provider: string;
  model: string;
  // Patterns to match against the model name from the SDK
  patterns: string[];
  input_price_per_1m: number; // USD per 1M input tokens
  output_price_per_1m: number; // USD per 1M output tokens
  cached_input_price_per_1m?: number; // USD per 1M cached input tokens (cache hits)
}

// ---------------------------------------------------------------------------
// Pricing as of April 2026
//
// Verified sources:
//   Anthropic  - platform.claude.com/docs/en/about-claude/pricing (verified Apr 2026)
//   Google     - ai.google.dev/pricing (verified Apr 2026)
//   DeepSeek   - api-docs.deepseek.com/quick_start/pricing (verified Apr 2026)
//   OpenAI     - GPT-4o confirmed via Azure pricing; GPT-4.1/o-series from
//                openai.com/api/pricing (could not scrape, prices from training data)
//   Mistral    - mistral.ai/pricing (could not scrape, prices from training data)
//   Meta       - pricing varies by host; prices below reflect typical API hosting
//
// IMPORTANT: OpenAI GPT-4.1 series, o-series, Mistral, and Meta Llama 4
// prices could not be independently verified via web scrape. Double-check
// these against the provider's current pricing page before production use.
// ---------------------------------------------------------------------------

export const MODEL_PRICING: ModelPricing[] = [
  // ── Anthropic (VERIFIED Apr 2026) ──────────────────────────────────────
  //
  // Opus 4.7 / 4.6 / 4.5: $5 input, $25 output, $0.50 cache hit
  // Opus 4.1 / 4.0:       $15 input, $75 output, $1.50 cache hit
  // Sonnet 4.6 / 4.5 / 4: $3 input, $15 output, $0.30 cache hit
  // Haiku 4.5:            $1 input, $5 output, $0.10 cache hit
  // Haiku 3.5:            $0.80 input, $4 output, $0.08 cache hit

  { provider: 'anthropic', model: 'Claude Opus 4.7', patterns: ['claude-opus-4-7', 'claude-opus-4.7'], input_price_per_1m: 5, output_price_per_1m: 25, cached_input_price_per_1m: 0.50 },
  { provider: 'anthropic', model: 'Claude Opus 4.6', patterns: ['claude-opus-4-6', 'claude-opus-4.6'], input_price_per_1m: 5, output_price_per_1m: 25, cached_input_price_per_1m: 0.50 },
  { provider: 'anthropic', model: 'Claude Opus 4.5', patterns: ['claude-opus-4-5', 'claude-opus-4.5', 'claude-opus-4-5-20251101'], input_price_per_1m: 5, output_price_per_1m: 25, cached_input_price_per_1m: 0.50 },
  { provider: 'anthropic', model: 'Claude Opus 4.1', patterns: ['claude-opus-4-1', 'claude-opus-4.1', 'claude-opus-4-1-20250805'], input_price_per_1m: 15, output_price_per_1m: 75, cached_input_price_per_1m: 1.50 },
  { provider: 'anthropic', model: 'Claude Opus 4', patterns: ['claude-opus-4-20250514', 'claude-opus-4-0'], input_price_per_1m: 15, output_price_per_1m: 75, cached_input_price_per_1m: 1.50 },
  { provider: 'anthropic', model: 'Claude Sonnet 4.6', patterns: ['claude-sonnet-4-6', 'claude-sonnet-4.6'], input_price_per_1m: 3, output_price_per_1m: 15, cached_input_price_per_1m: 0.30 },
  { provider: 'anthropic', model: 'Claude Sonnet 4.5', patterns: ['claude-sonnet-4-5', 'claude-sonnet-4.5', 'claude-sonnet-4-5-20250929'], input_price_per_1m: 3, output_price_per_1m: 15, cached_input_price_per_1m: 0.30 },
  { provider: 'anthropic', model: 'Claude Sonnet 4', patterns: ['claude-sonnet-4-20250514', 'claude-sonnet-4-0'], input_price_per_1m: 3, output_price_per_1m: 15, cached_input_price_per_1m: 0.30 },
  { provider: 'anthropic', model: 'Claude Haiku 4.5', patterns: ['claude-haiku-4-5', 'claude-haiku-4.5', 'claude-haiku-4-5-20251001'], input_price_per_1m: 1, output_price_per_1m: 5, cached_input_price_per_1m: 0.10 },
  { provider: 'anthropic', model: 'Claude Haiku 3.5', patterns: ['claude-haiku-3-5', 'claude-3-5-haiku', 'claude-3-5-haiku-20241022'], input_price_per_1m: 0.80, output_price_per_1m: 4, cached_input_price_per_1m: 0.08 },

  // ── OpenAI (GPT-4o VERIFIED; others from training data -- verify) ──────
  { provider: 'openai', model: 'GPT-4o', patterns: ['gpt-4o', 'gpt-4o-2024'], input_price_per_1m: 2.50, output_price_per_1m: 10 },
  { provider: 'openai', model: 'GPT-4o mini', patterns: ['gpt-4o-mini'], input_price_per_1m: 0.15, output_price_per_1m: 0.60 },
  { provider: 'openai', model: 'GPT-4.1', patterns: ['gpt-4.1'], input_price_per_1m: 2.00, output_price_per_1m: 8.00 },
  { provider: 'openai', model: 'GPT-4.1 mini', patterns: ['gpt-4.1-mini'], input_price_per_1m: 0.40, output_price_per_1m: 1.60 },
  { provider: 'openai', model: 'GPT-4.1 nano', patterns: ['gpt-4.1-nano'], input_price_per_1m: 0.10, output_price_per_1m: 0.40 },
  { provider: 'openai', model: 'o3', patterns: ['o3-2025'], input_price_per_1m: 10, output_price_per_1m: 40 },
  { provider: 'openai', model: 'o3-mini', patterns: ['o3-mini'], input_price_per_1m: 1.10, output_price_per_1m: 4.40 },
  { provider: 'openai', model: 'o4-mini', patterns: ['o4-mini'], input_price_per_1m: 1.10, output_price_per_1m: 4.40 },

  // ── Google (VERIFIED Apr 2026) ─────────────────────────────────────────
  { provider: 'google', model: 'Gemini 2.5 Pro', patterns: ['gemini-2.5-pro', 'gemini-2.5-pro-preview'], input_price_per_1m: 1.25, output_price_per_1m: 10 },
  { provider: 'google', model: 'Gemini 2.5 Flash', patterns: ['gemini-2.5-flash', 'gemini-2.5-flash-preview'], input_price_per_1m: 0.30, output_price_per_1m: 2.50 },
  { provider: 'google', model: 'Gemini 2.5 Flash-Lite', patterns: ['gemini-2.5-flash-lite'], input_price_per_1m: 0.10, output_price_per_1m: 0.40 },
  { provider: 'google', model: 'Gemini 2.0 Flash', patterns: ['gemini-2.0-flash'], input_price_per_1m: 0.10, output_price_per_1m: 0.40 },
  { provider: 'google', model: 'Gemini 3 Flash', patterns: ['gemini-3-flash', 'gemini-3-flash-preview'], input_price_per_1m: 0.50, output_price_per_1m: 3.00 },
  { provider: 'google', model: 'Gemini 3.1 Pro', patterns: ['gemini-3.1-pro', 'gemini-3.1-pro-preview'], input_price_per_1m: 2.00, output_price_per_1m: 12.00 },

  // ── DeepSeek (VERIFIED Apr 2026 -- V4 models replace V3/R1) ────────────
  //
  // Note: deepseek-chat and deepseek-reasoner now map to V4-Flash modes.
  // V3 and R1 are no longer listed on their pricing page.
  { provider: 'deepseek', model: 'DeepSeek V4 Flash', patterns: ['deepseek-chat', 'deepseek-v4-flash', 'deepseek-v4'], input_price_per_1m: 0.14, output_price_per_1m: 0.28 },
  { provider: 'deepseek', model: 'DeepSeek V4 Pro', patterns: ['deepseek-reasoner', 'deepseek-v4-pro'], input_price_per_1m: 1.74, output_price_per_1m: 3.48 },

  // ── Meta (prices vary by hosting provider -- verify) ───────────────────
  { provider: 'meta', model: 'Llama 4 Maverick', patterns: ['llama-4-maverick', 'meta-llama/llama-4-maverick'], input_price_per_1m: 0.20, output_price_per_1m: 0.60 },
  { provider: 'meta', model: 'Llama 4 Scout', patterns: ['llama-4-scout', 'meta-llama/llama-4-scout'], input_price_per_1m: 0.10, output_price_per_1m: 0.30 },

  // ── Mistral (could not scrape -- verify against mistral.ai/pricing) ────
  { provider: 'mistral', model: 'Mistral Large', patterns: ['mistral-large', 'mistral-large-latest'], input_price_per_1m: 2.00, output_price_per_1m: 6.00 },
  { provider: 'mistral', model: 'Mistral Small', patterns: ['mistral-small', 'mistral-small-latest'], input_price_per_1m: 0.10, output_price_per_1m: 0.30 },
];

/**
 * Calculate cost for a given model and token counts.
 *
 * Returns `{ cost_usd, model_found }`.  When the model is not in the pricing
 * table `cost_usd` is 0 and `model_found` is false -- callers should flag
 * this so users know the cost is missing, not zero.
 */
export function calculateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens?: number,
): { cost_usd: number; model_found: boolean } {
  const normalizedModel = modelName.toLowerCase();

  const pricing = MODEL_PRICING.find((p) =>
    p.patterns.some((pattern) => normalizedModel.includes(pattern.toLowerCase())),
  );

  if (!pricing) {
    return { cost_usd: 0, model_found: false };
  }

  // If cached tokens are reported, subtract them from input so we don't
  // double-count.  The cached portion is billed at the (lower) cache-hit rate.
  const regularInputTokens = cachedInputTokens
    ? Math.max(0, inputTokens - cachedInputTokens)
    : inputTokens;

  const inputCost = (regularInputTokens / 1_000_000) * pricing.input_price_per_1m;
  const outputCost = (outputTokens / 1_000_000) * pricing.output_price_per_1m;
  const cachedCost =
    cachedInputTokens && pricing.cached_input_price_per_1m
      ? (cachedInputTokens / 1_000_000) * pricing.cached_input_price_per_1m
      : 0;

  return {
    cost_usd: inputCost + outputCost + cachedCost,
    model_found: true,
  };
}

/**
 * Look up pricing metadata for a model name.
 * Returns `undefined` when no match is found.
 */
export function getModelPricing(modelName: string): ModelPricing | undefined {
  const normalizedModel = modelName.toLowerCase();
  return MODEL_PRICING.find((p) =>
    p.patterns.some((pattern) => normalizedModel.includes(pattern.toLowerCase())),
  );
}
