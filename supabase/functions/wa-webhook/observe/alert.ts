import { fetchWithTimeout } from "../utils/http.ts";

const ALERT_WEBHOOK_URL = Deno.env.get("ALERT_WEBHOOK_URL") ?? "";
const ALERT_TIMEOUT_MS = Math.max(
  Number(Deno.env.get("ALERT_WEBHOOK_TIMEOUT_MS") ?? "5000") || 5000,
  1000,
);

export async function emitAlert(
  event: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!ALERT_WEBHOOK_URL) return;
  try {
    await fetchWithTimeout(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        event,
        payload,
        timestamp: new Date().toISOString(),
      }),
      timeoutMs: ALERT_TIMEOUT_MS,
      retries: 0,
    });
  } catch (error) {
    console.error("alert.emit_fail", error, { event });
  }
}
