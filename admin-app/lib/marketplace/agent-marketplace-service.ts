import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockMarketplaceSessions } from "@/lib/mock-data";
import { paginateArray, type PaginatedResult, type Pagination } from "@/lib/shared/pagination";
import type {
  MarketplaceAgentSession,
} from "@/lib/marketplace/types";

export type MarketplaceAgentSessionListParams = Pagination & {
  agentType: string;
  flowType?: string;
};

interface MarketplaceSessionResponse {
  data: MarketplaceAgentSession[];
  total: number;
  hasMore?: boolean;
}

const useMocks = shouldUseMocks();

export async function listMarketplaceAgentSessions(
  params: MarketplaceAgentSessionListParams,
): Promise<PaginatedResult<MarketplaceAgentSession>> {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 25;

  if (useMocks) {
    const filtered = mockMarketplaceSessions.filter((session) => session.agentType === params.agentType);
    return paginateArray(filtered, { offset, limit });
  }

  const searchParams = new URLSearchParams();
  searchParams.set("agentType", params.agentType);
  if (params.flowType) searchParams.set("flowType", params.flowType);
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));

  const url = `${getAdminApiPath("marketplace/agent-sessions")}?${searchParams.toString()}`;

  const response = await apiFetch<MarketplaceSessionResponse>(url);
  return {
    data: response.data,
    total: response.total,
    hasMore: response.hasMore ?? (offset + response.data.length < response.total),
  };
}
