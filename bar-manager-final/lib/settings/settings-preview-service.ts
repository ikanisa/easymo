import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import type { SettingEntry } from "@/lib/schemas";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";

export async function listSettingsPreview(
  params: Pagination = {},
): Promise<PaginatedResult<SettingEntry>> {
  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;

  const response = await apiFetch<{ data: SettingEntry[]; total: number; hasMore?: boolean }>(
    `${getAdminApiPath("settings", "preview")}?limit=${limit}&offset=${offset}`,
  );

  return {
    data: response.data,
    total: response.total,
    hasMore: response.hasMore ?? (offset + response.data.length < response.total),
  };
}
