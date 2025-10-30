/**
 * Structured logging configuration
 * Implements EasyMO Ground Rules observability requirements
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  correlation_id?: string;
  user_id?: string;
  session_id?: string;
  [key: string]: any;
}

/**
 * PII fields that should be masked in logs
 */
const PII_FIELDS = ["msisdn", "phone", "phone_number", "email", "customer_msisdn"];

/**
 * Mask PII in log data
 * Implements Ground Rules security requirement
 */
export function maskPII(data: any): any {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(maskPII);
  }

  const masked: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (PII_FIELDS.includes(key.toLowerCase()) && typeof value === "string") {
      // Mask phone numbers: show first 5 and last 3 digits
      if (value.length > 8) {
        masked[key] = value.substring(0, 5) + "***" + value.substring(value.length - 3);
      } else {
        masked[key] = "***";
      }
    } else if (typeof value === "object") {
      masked[key] = maskPII(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

/**
 * Log a structured event with JSON output
 * Follows Ground Rules observability pattern
 */
export function logStructuredEvent(
  eventType: string,
  context: LogContext,
  message?: string,
  level: LogLevel = "info"
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    event: eventType,
    message,
    ...maskPII(context),
  };

  const logString = JSON.stringify(logEntry);

  switch (level) {
    case "error":
      console.error(logString);
      break;
    case "warn":
      console.warn(logString);
      break;
    case "debug":
      if (process.env.LOG_LEVEL === "debug") {
        console.debug(logString);
      }
      break;
    default:
      console.log(logString);
  }
}

/**
 * Create a logger with default context
 */
export function createLogger(defaultContext: LogContext = {}) {
  return {
    debug: (event: string, context: LogContext = {}, message?: string) =>
      logStructuredEvent(event, { ...defaultContext, ...context }, message, "debug"),
    info: (event: string, context: LogContext = {}, message?: string) =>
      logStructuredEvent(event, { ...defaultContext, ...context }, message, "info"),
    warn: (event: string, context: LogContext = {}, message?: string) =>
      logStructuredEvent(event, { ...defaultContext, ...context }, message, "warn"),
    error: (event: string, context: LogContext = {}, message?: string) =>
      logStructuredEvent(event, { ...defaultContext, ...context }, message, "error"),
  };
}
