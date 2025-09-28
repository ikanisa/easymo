"use client";

import { useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { OrdersClient } from "@/components/orders/OrdersClient";
import { OrderEventsList } from "@/components/orders/OrderEventsList";
import { LoadingState } from "@/components/ui/LoadingState";
import { type OrdersQueryParams, useOrdersQuery } from "@/lib/queries/orders";
import { listLatestOrderEvents } from "@/lib/data-provider";

interface OrdersClientWrapperProps {
  initialOrdersParams?: OrdersQueryParams;
}

export function OrdersClientWrapper(
  { initialOrdersParams = { limit: 200 } }: OrdersClientWrapperProps,
) {
  const [params] = useState(initialOrdersParams);
  const ordersQuery = useOrdersQuery(params);
  const events = listLatestOrderEvents();

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
          : <OrdersClient orders={ordersQuery.data?.data ?? []} />}
      </SectionCard>

      <SectionCard
        title="Latest events"
        description="Quick view of the last 10 order events to help triage issues."
      >
        <OrderEventsList events={events} />
      </SectionCard>
    </div>
  );
}
