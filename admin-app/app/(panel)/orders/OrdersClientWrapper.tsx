"use client";

import { useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { OrdersClient } from "@/components/orders/OrdersClient";
import { OrderEventsList } from "@/components/orders/OrderEventsList";
import { LoadingState } from "@/components/ui/LoadingState";
import { type OrdersQueryParams, useOrdersQuery } from "@/lib/queries/orders";
import { useDashboardOrderEventsQuery } from "@/lib/queries/dashboard";

interface OrdersClientWrapperProps {
  initialOrdersParams?: OrdersQueryParams;
}

export function OrdersClientWrapper(
  { initialOrdersParams = { limit: 200 } }: OrdersClientWrapperProps,
) {
  const [params, setParams] = useState(initialOrdersParams);
  const ordersQuery = useOrdersQuery(params);
  const orderEventsQuery = useDashboardOrderEventsQuery();
  const events = orderEventsQuery.data ?? [];
  const hasMore = ordersQuery.data?.hasMore;
  const isLoadingMore = ordersQuery.isFetching && !ordersQuery.isLoading;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Live orders"
        description="Use overrides to cancel, nudge, or reopen orders. Policies will govern availability once Supabase data is wired."
      >
        {ordersQuery.isLoading
          ? (
            <LoadingState
              title="Loading orders"
              description="Fetching latest order roster."
            />
          )
          : (
            <OrdersClient
              orders={ordersQuery.data?.data ?? []}
              hasMore={hasMore}
              loadingMore={isLoadingMore}
              onLoadMore={() =>
                setParams((prev) => ({
                  ...prev,
                  limit: (prev.limit ?? 200) + 50,
                }))}
            />
          )}
      </SectionCard>

      <SectionCard
        title="Latest events"
        description="Quick view of the last 10 order events to help triage issues."
      >
        {orderEventsQuery.isLoading
          ? (
            <LoadingState
              title="Loading order events"
              description="Fetching recent activity."
            />
          )
          : <OrderEventsList events={events} />}
      </SectionCard>
    </div>
  );
}
