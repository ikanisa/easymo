"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StationListWithActions } from "@/components/stations/StationListWithActions";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  type StationsQueryParams,
  useStationsQuery,
} from "@/lib/queries/stations";

interface StationsClientProps {
  initialParams?: StationsQueryParams;
}

export function StationsClient(
  { initialParams = { limit: 200 } }: StationsClientProps,
) {
  const [params] = useState<StationsQueryParams>(initialParams);
  const stationsQuery = useStationsQuery(params);

  const stations = stationsQuery.data?.data ?? [];

  return (
    <div className="admin-page">
      <PageHeader
        title="Stations"
        description="Manage station records, operator contacts, and recent voucher redemptions."
      />
      <SectionCard
        title="Station directory"
        description="Create, activate/deactivate, and delete stations. Actions currently persist only when Supabase credentials are configured."
      >
        {stationsQuery.isLoading
          ? (
            <LoadingState
              title="Loading stations"
              description="Fetching current station roster."
            />
          )
          : stations.length
          ? <StationListWithActions stations={stations} />
          : (
            <EmptyState
              title="No stations"
              description="Add a station to get started or connect Supabase to view existing records."
            />
          )}
      </SectionCard>
    </div>
  );
}
