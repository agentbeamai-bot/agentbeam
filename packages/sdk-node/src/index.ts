export { AgentBeamClient as AgentBeam } from './client';
export { SpanBuilder, startSpan } from './trace';
export { estimateCost } from './cost';
export type {
  AgentBeamConfig,
  SpanKind,
  SpanStatus,
  SpanData,
  IngestPayload,
} from './types';
export type { StartSpanOptions } from './trace';
