/**
 * Unified Observability Module
 * Provides structured logging, error tracking, metrics, and PII scrubbing
 * 
 * Phase 2: Consolidated from 4 different logging systems:
 * - _shared/observability.ts (simple)
 * - wa-webhook-mobility/observe/log.ts (DB logging)
 * - wa-webhook-mobility/observe/logging.ts (wrapper)
 * - wa-webhook-mobility/observe/logger.ts (full Sentry + PostHog)
 */

export {
  logStructuredEvent,
  recordMetric,
  logError,
  scrubPII,
  normalizeError,
  serveWithObservability,
  createJsonErrorResponse,
  type StructuredLogger,
  type ObservabilityContext,
} from "./logger.ts";
