"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StaffNumbersTable } from "@/components/staff/StaffNumbersTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  type StaffNumbersQueryParams,
  useStaffNumbersQuery,
} from "@/lib/queries/staffNumbers";

interface StaffNumbersClientProps {
  initialParams?: StaffNumbersQueryParams;
}

export function StaffNumbersClient(
  { initialParams = { limit: 200 } }: StaffNumbersClientProps,
) {
  const [params, setParams] = useState(initialParams);
  const staffNumbersQuery = useStaffNumbersQuery(params);
  const staffNumbers = staffNumbersQuery.data?.data ?? [];
  const hasMore = staffNumbersQuery.data?.hasMore;
  const isLoadingMore = staffNumbersQuery.isFetching && !staffNumbersQuery.isLoading;

  return (
    <div className="admin-page">
      <PageHeader
        title="Staff Numbers"
        description="Platform-wide directory of receiving numbers, roles, and verification status."
      />
      <SectionCard
        title="Receiving numbers"
        description="Actions to deactivate, verify, or change roles will be added once write APIs are in place."
      >
        {staffNumbersQuery.isLoading
          ? (
            <LoadingState
              title="Loading staff numbers"
              description="Fetching latest receiving numbers."
            />
          )
          : staffNumbers.length
          ? (
            <StaffNumbersTable
              data={staffNumbers}
              hasMore={hasMore}
              loadingMore={isLoadingMore}
              onLoadMore={() =>
                setParams((prev) => ({
                  ...prev,
                  limit: (prev.limit ?? 200) + 50,
                }))}
            />
          )
          : (
            <EmptyState
              title="No staff numbers yet"
              description="Load fixtures or connect to Supabase to view receiving numbers."
            />
          )}
      </SectionCard>
    </div>
  );
}
