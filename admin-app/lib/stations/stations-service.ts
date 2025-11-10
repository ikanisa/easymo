import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockStations } from "@/lib/mock-data";
import { matchesSearch } from "@/lib/shared/search";
import {
  paginateArray,
  type PaginatedResult,
  type Pagination,
} from "@/lib/shared/pagination";
import type { Station } from "@/lib/schemas";

const useMocks = shouldUseMocks();
const isServer = typeof window === "undefined";

export type StationListParams = Pagination & {
  search?: string;
  status?: Station["status"];
};

export async function listStations(
  params: StationListParams = {},
): Promise<PaginatedResult<Station>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 200;

  if (useMocks) {
    const filtered = filterStations(mockStations, params);
    return paginateArray(filtered, { offset, limit });
  }

  if (!isServer) {
    const response = await fetchStationsApi({ ...params, offset, limit });
    if (response.ok) {
      return response.value;
    }
  }

  const response = await fetchStationsApi({ ...params, offset, limit });
  if (response.ok) {
    return response.value;
  }

  const filtered = filterStations(mockStations, params);
  return paginateArray(filtered, { offset, limit });
}

function filterStations(stations: Station[], params: StationListParams) {
  return stations.filter((station) => {
    const statusMatch = params.status ? station.status === params.status : true;
    const searchMatch = matchesSearch(
      `${station.name} ${station.engencode}`,
      params.search,
    );
    return statusMatch && searchMatch;
  });
}

type StationsApiResponse = {
  data: Station[];
  total: number;
  hasMore?: boolean;
};

type StationApiParams = StationListParams & {
  offset: number;
  limit: number;
};

async function fetchStationsApi(params: StationApiParams) {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit));
  searchParams.set("offset", String(params.offset));
  if (params.status) searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);

  try {
    const response = await apiFetch<StationsApiResponse>(
      `${getAdminApiPath("stations")}?${searchParams.toString()}`,
    );

    return {
      ok: true as const,
      value: {
        data: response.data,
        total: response.total,
        hasMore: response.hasMore ?? (params.offset + response.data.length < response.total),
      },
    };
  } catch (error) {
    console.error("Failed to fetch stations", error);
    return { ok: false as const };
  }
}
