import { mockAuditEvents } from "@/lib/mock-data";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import type { AuditEvent } from "@/lib/schemas";

export async function listAuditEvents(
  params: Pagination = {},
): Promise<PaginatedResult<AuditEvent>> {
  return paginateArray(mockAuditEvents, params);
}
