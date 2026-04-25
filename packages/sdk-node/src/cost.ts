/**
 * Inline pricing table for client-side cost estimation.
 * Prices are per 1M tokens in USD.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4': { input: 15, output: 75 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-haiku-3.5': { input: 0.8, output: 4 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'deepseek-chat': { input: 0.27, output: 1.1 },
};

/**
 * Estimate the cost of a single LLM call in USD.
 * Uses fuzzy matching: the model name only needs to *contain* a known key.
 * Returns 0 if the model is not recognized.
 */
export function estimateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const normalized = modelName.toLowerCase();
  const entry = Object.entries(MODEL_PRICING).find(([key]) =>
    normalized.includes(key),
  );
  if (!entry) return 0;
  const [, pricing] = entry;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}
