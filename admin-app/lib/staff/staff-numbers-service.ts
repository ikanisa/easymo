import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockStaffNumbers } from "@/lib/mock-data";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import { matchesSearch } from "@/lib/shared/search";
import type { StaffNumber } from "@/lib/schemas";

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

export type StaffNumberListParams = Pagination & {
  search?: string;
  role?: string;
  active?: boolean;
};

export async function listStaffNumbers(
  params: StaffNumberListParams = {},
): Promise<PaginatedResult<StaffNumber>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 200;

  if (!isServer) {
    const result = await fetchStaffNumbersApi({ ...params, offset, limit });
    if (result) {
      return result;
    }
  }

  if (useMocks) {
    const filtered = filterStaff(mockStaffNumbers, params);
    return paginateArray(filtered, { offset, limit });
  }

  const response = await fetchStaffNumbersApi({ ...params, offset, limit });
  if (response) {
    return response;
  }

  const filtered = filterStaff(mockStaffNumbers, params);
  return paginateArray(filtered, { offset, limit });
}

function filterStaff(staff: StaffNumber[], params: StaffNumberListParams) {
  return staff.filter((item) => {
    const roleMatch = params.role ? item.role === params.role : true;
    const activeMatch = params.active === undefined
      ? true
      : item.active === params.active;
    const searchMatch = matchesSearch(
      `${item.barName} ${item.number}`,
      params.search,
    );
    return roleMatch && activeMatch && searchMatch;
  });
}

type StaffApiResponse = {
  data: StaffNumber[];
  total: number;
  hasMore?: boolean;
};

type StaffApiParams = StaffNumberListParams & {
  offset: number;
  limit: number;
};

async function fetchStaffNumbersApi(
  params: StaffApiParams,
): Promise<PaginatedResult<StaffNumber> | null> {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit));
  searchParams.set("offset", String(params.offset));
  if (params.search) searchParams.set("search", params.search);
  if (params.role) searchParams.set("role", params.role);
  if (typeof params.active === "boolean") {
    searchParams.set("active", params.active ? "true" : "false");
  }

  const response = await apiFetch<StaffApiResponse>(
    `${getAdminApiPath("staff")}?${searchParams.toString()}`,
  );

  if (response.ok) {
    const { data, total, hasMore } = response.data;
    return {
      data,
      total,
      hasMore: hasMore ?? (params.offset + data.length < total),
    };
  }

  console.error("Failed to fetch staff numbers", response.error);
  return null;
}
