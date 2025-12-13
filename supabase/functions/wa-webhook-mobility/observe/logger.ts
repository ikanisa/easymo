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
    logStructuredEvent("ERROR", { error: JSON.stringify(logData }, "error"););
  } else if (level === "warn") {
    logStructuredEvent("WARNING", { message: JSON.stringify(logData }, "warn"););
  } else {
    logStructuredEvent("DEBUG", { data: JSON.stringify(logData }););
  }
}

export { logEvent as default };
