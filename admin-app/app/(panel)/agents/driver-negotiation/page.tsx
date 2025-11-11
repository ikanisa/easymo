export const dynamic = "force-dynamic";

import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { DriverAgentClient } from "./DriverAgentClient";
import { createQueryClient } from "@/lib/api/queryClient";
import {
  driverQueryKeys,
  fetchDriverRequests,
} from "@/lib/queries/agents";

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
