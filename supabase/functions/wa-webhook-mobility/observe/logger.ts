/**
 * Observability Logger
 * Simple event logging for mobility webhook
 */

export async function logEvent(
  event: string,
  details: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info",
): Promise<void> {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    event,
    level,
    ...details,
  };

  if (level === "error") {
    console.error(JSON.stringify(logData));
  } else if (level === "warn") {
    console.warn(JSON.stringify(logData));
  } else {
    console.log(JSON.stringify(logData));
  }
}

export { logEvent as default };
