import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockWebhookErrors } from "@/lib/mock-data";
import type { WebhookError } from "@/lib/schemas";

const useMocks = shouldUseMocks();

export async function listLatestWebhookErrors(
  limit = 10,
): Promise<WebhookError[]> {
  if (useMocks) {
    return mockWebhookErrors.slice(0, limit);
  }

  try {
    const url = `${getAdminApiPath("webhooks", "errors")}?limit=${limit}`;
    const response = await apiFetch<{ data: WebhookError[] }>(url);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch webhook errors", error);
    return mockWebhookErrors.slice(0, limit);
  }
}
