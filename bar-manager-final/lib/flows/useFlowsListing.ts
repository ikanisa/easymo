import { useMemo, useState } from "react";

import {
  type FlowsQueryParams,
  useFlowsQuery,
} from "@/lib/queries/flows";
import type { FlowMeta } from "@/lib/schemas";

type UseFlowsListingOptions = {
  initialParams?: FlowsQueryParams;
  loadStep?: number;
};

export function useFlowsListing(
  { initialParams = { limit: 100 }, loadStep = 25 }: UseFlowsListingOptions = {},
) {
  const [params, setParams] = useState<FlowsQueryParams>(initialParams);
  const query = useFlowsQuery(params);

  const flows = query.data?.data ?? [];
  const hasMore = query.data?.hasMore;
  const loadingMore = query.isFetching && !query.isLoading;
  const statusFilter = params.status ?? "";
  const resetLimit = useMemo(() => initialParams.limit ?? 100, [initialParams.limit]);

  const handleStatusChange = (value: FlowMeta["status"] | "") => {
    setParams((prev) => ({
      ...prev,
      status: value || undefined,
      limit: resetLimit,
      offset: 0,
    }));
  };

  const handleLoadMore = () => {
    setParams((prev) => ({
      ...prev,
      limit: (prev.limit ?? resetLimit) + loadStep,
    }));
  };

  return {
    params,
    setParams,
    query,
    flows,
    hasMore,
    loadingMore,
    statusFilter,
    handleStatusChange,
    handleLoadMore,
  };
}
