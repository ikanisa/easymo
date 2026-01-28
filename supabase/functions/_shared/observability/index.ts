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
  createJsonErrorResponse,
  logError,
  logStructuredEvent,
  normalizeError,
  type ObservabilityContext,
  recordMetric,
  scrubPII,
  serveWithObservability,
  type StructuredLogger,
} from "./logger.ts";
