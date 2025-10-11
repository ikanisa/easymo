import { useMemo, useState } from "react";
import type { TemplateMeta } from "@/lib/schemas";
import {
  useTemplatesQuery,
  type TemplatesQueryParams,
} from "@/lib/queries/templates";

type UseTemplatesListingOptions = {
  initialParams?: TemplatesQueryParams;
  loadStep?: number;
};

export function useTemplatesListing(
  { initialParams = { limit: 100 }, loadStep = 50 }: UseTemplatesListingOptions = {},
) {
  const [params, setParams] = useState<TemplatesQueryParams>(initialParams);
  const query = useTemplatesQuery(params);

  const templates = query.data?.data ?? [];
  const hasMore = query.data?.hasMore;
  const loadingMore = query.isFetching && !query.isLoading;
  const statusFilter = params.status ?? "";

  const resetLimit = useMemo(() => initialParams.limit ?? 100, [initialParams.limit]);

  const handleStatusChange = (value: TemplateMeta["status"] | "") => {
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
    templates,
    hasMore,
    loadingMore,
    statusFilter,
    handleStatusChange,
    handleLoadMore,
  };
}
