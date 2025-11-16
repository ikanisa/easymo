// Structured logging utilities

export interface LogEvent {
  event: string;
  correlationId?: string;
  timestamp?: string;
  level?: "info" | "warn" | "error" | "debug";
  [key: string]: unknown;
}

export async function logStructuredEvent(
  event: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const logEntry: LogEvent = {
    event,
    timestamp: new Date().toISOString(),
    level: "info",
    ...data,
  };
  
  console.log(JSON.stringify(logEntry));
}

export async function logError(
  event: string,
  error: Error | unknown,
  context: Record<string, unknown> = {}
): Promise<void> {
  const logEntry: LogEvent = {
    event,
    timestamp: new Date().toISOString(),
    level: "error",
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  };
  
  console.error(JSON.stringify(logEntry));
}

export async function logWarn(
  event: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const logEntry: LogEvent = {
    event,
    timestamp: new Date().toISOString(),
    level: "warn",
    ...data,
  };
  
  console.warn(JSON.stringify(logEntry));
}
