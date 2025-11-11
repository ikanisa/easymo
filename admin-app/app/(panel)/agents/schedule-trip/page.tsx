export const dynamic = "force-dynamic";

import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import {
  fetchScheduledTrips,
  scheduleTripQueryKeys,
} from "@/lib/queries/schedule-trips";
import { ScheduleTripAgentClient } from "./ScheduleTripAgentClient";

export default async function ScheduleTripAgentPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: scheduleTripQueryKeys.list(),
    queryFn: fetchScheduledTrips,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ScheduleTripAgentClient />
    </HydrationBoundary>
  );
}
