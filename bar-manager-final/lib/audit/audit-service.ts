import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import type { AuditEvent } from "@/lib/schemas";
import { type PaginatedResult, type Pagination } from "@/lib/shared/pagination";

export async function listAuditEvents(
  params: Pagination = {},
): Promise<PaginatedResult<AuditEvent>> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  const response = await apiFetch<{ data: AuditEvent[]; total: number; hasMore?: boolean }>(
    `${getAdminApiPath("audit")}?limit=${limit}&offset=${offset}`,
  );
  return {
    data: response.data,
    total: response.total,
    hasMore: response.hasMore ?? (offset + response.data.length < response.total),
  };
}
