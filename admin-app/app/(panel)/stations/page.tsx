export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { StationsClient } from "./StationsClient";
import {
  fetchStations,
  stationsQueryKeys,
  type StationsQueryParams,
} from "@/lib/queries/stations";

const DEFAULT_PARAMS: StationsQueryParams = { limit: 200 };

export default async function StationsPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: stationsQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchStations(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <StationsClient initialParams={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}
