"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { StationListWithActions } from "@/components/stations/StationListWithActions";
import {
  useStationsQuery,
  type StationsQueryParams,
} from "@/lib/queries/stations";

const DEFAULT_PARAMS: StationsQueryParams = { limit: 200 };

interface StationsClientProps {
  initialParams?: StationsQueryParams;
}

export function StationsClient(
  { initialParams = DEFAULT_PARAMS }: StationsClientProps,
) {
  const query = useStationsQuery(initialParams);
  const stations = query.data?.data ?? [];

  if (query.isLoading) {
    return (
      <LoadingState
        title="Loading stations"
        description="Fetching station roster and Engen codes."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stations"
        description="Manage Engen partners, statuses, and owner contacts."
      />
      {stations.length === 0
        ? (
          <EmptyState
            title="No stations"
            description="New partner stations will appear here once added."
          />
        )
        : (
          <StationListWithActions
            stations={stations}
            hasMore={query.data?.hasMore}
            loadingMore={query.isFetching}
          />
        )}
    </div>
  );
}
