import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import type { WebhookError } from "@/lib/schemas";

export async function listLatestWebhookErrors(
  limit = 10,
): Promise<WebhookError[]> {
  try {
    const url = `${getAdminApiPath("webhooks", "errors")}?limit=${limit}`;
    const response = await apiFetch<{ data: WebhookError[] }>(url);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch webhook errors", error);
    return [];
  }
}
