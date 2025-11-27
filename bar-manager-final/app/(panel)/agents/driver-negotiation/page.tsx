export const dynamic = "force-dynamic";

import { dehydrate,HydrationBoundary } from "@tanstack/react-query";

import { createQueryClient } from "@/lib/api/queryClient";
import {
  driverQueryKeys,
  fetchDriverRequests,
} from "@/lib/queries/agents";

import { DriverAgentClient } from "./DriverAgentClient";

export default async function DriverNegotiationAgentPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: driverQueryKeys.requests(),
    queryFn: fetchDriverRequests,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DriverAgentClient />
    </HydrationBoundary>
  );
}
