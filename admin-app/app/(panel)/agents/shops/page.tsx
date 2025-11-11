export const dynamic = "force-dynamic";

import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { ShopsAgentClient } from "./ShopsAgentClient";
import { fetchShops, shopsQueryKeys } from "@/lib/queries/shops";

export default async function ShopsAgentPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: shopsQueryKeys.list(),
    queryFn: fetchShops,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ShopsAgentClient />
    </HydrationBoundary>
  );
}

