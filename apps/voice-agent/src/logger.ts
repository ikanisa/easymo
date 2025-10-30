import pino from "pino";

const LOG_LEVEL = process.env.LOG_LEVEL || "info";

/**
 * Structured logger using Pino.
 * All logs are in JSON format with timestamps and correlation IDs.
 * Following EasyMO ground rules for observability.
 */
export const logger = pino({
  level: LOG_LEVEL,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: "voice-agent",
    pid: process.pid,
  },
});

/**
 * Create a child logger with additional context.
 * Useful for adding correlation IDs and request-specific data.
 */
export function childLogger(context: Record<string, any>) {
  return logger.child(context);
}

/**
 * Log a structured event with consistent format.
 * Following EasyMO ground rules for event logging.
 */
export function logStructuredEvent(
  event: string,
  metadata: Record<string, any> = {},
) {
  logger.info({
    event,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}
