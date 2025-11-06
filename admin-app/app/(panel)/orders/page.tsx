export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrdersClientWrapper } from "./OrdersClientWrapper";
import {
  fetchOrders,
  ordersQueryKeys,
  type OrdersQueryParams,
} from "@/lib/queries/orders";

const DEFAULT_PARAMS: OrdersQueryParams = { limit: 200 };

export default async function OrdersPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ordersQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchOrders(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="admin-page">
        <PageHeader
          title="Orders"
          description="Monitor order lifecycle, nudge vendors, and execute policy-controlled overrides."
        />
        <OrdersClientWrapper initialOrdersParams={DEFAULT_PARAMS} />
      </div>
    </HydrationBoundary>
  );
}

export const runtime = "edge";
