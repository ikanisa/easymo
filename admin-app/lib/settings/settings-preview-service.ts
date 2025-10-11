import { mockSettingsEntries } from "@/lib/mock-data";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import type { SettingEntry } from "@/lib/schemas";

export async function listSettingsPreview(
  params: Pagination = {},
): Promise<PaginatedResult<SettingEntry>> {
  return paginateArray(mockSettingsEntries, params);
}
