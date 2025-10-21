import { env } from "../env.server";

interface LogContext {
  event: string;
  target?: string;
  actor?: string;
  entity?: string;
  status?: "ok" | "degraded" | "error";
  message?: string;
  details?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  [key: string]: unknown;
}

export function logStructured(context: LogContext) {
  const payload = {
    timestamp: new Date().toISOString(),
    ...context,
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);

  // Optional: forward logs to an external drain if configured.
  try {
    const drainUrl = env.logging.drainUrl ?? undefined;
    if (drainUrl) {
      // Fire-and-forget; do not block request lifecycle.
      void fetch(drainUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        // Avoid keeping the event loop alive; ignore result.
      }).catch(() => {});
    }
  } catch {
    // Never throw from logger.
  }
}
