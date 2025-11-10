export const dynamic = "force-dynamic";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { ShopsClient } from "./ShopsClient";
import {
  fetchShops,
  shopsQueryKeys,
  type ShopsQueryParams,
} from "@/lib/queries/shops";

const DEFAULT_PARAMS: ShopsQueryParams = {
  limit: 50,
};

export default async function ShopsPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: shopsQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchShops(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <ShopsClient initialParams={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}
