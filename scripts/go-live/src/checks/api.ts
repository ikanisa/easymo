import { config } from "../config.js";
import type { CheckStatus,HealthCheck } from "../types.js";

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function createCheck(
  name: string,
  fn: () => Promise<{ status: CheckStatus; message: string; details?: Record<string, unknown> }>
): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const result = await fn();
    return {
      name,
      category: "API",
      status: result.status,
      message: result.message,
      details: result.details,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name,
      category: "API",
      status: "fail",
      message: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function checkNewPortalHealth(): Promise<HealthCheck> {
  return createCheck("New Portal Health", async () => {
    if (!config.NEW_VENDOR_PORTAL_URL) {
      return { status: "skip", message: "Portal URL not configured" };
    }

    const response = await fetchWithTimeout(`${config.NEW_VENDOR_PORTAL_URL}/api/health`);

    if (!response.ok) {
      return { status: "fail", message: `HTTP ${response.status}` };
    }

    return { status: "pass", message: "New portal healthy" };
  });
}

export const apiChecks = [checkNewPortalHealth];
