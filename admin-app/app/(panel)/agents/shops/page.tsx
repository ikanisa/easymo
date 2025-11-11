export const dynamic = "force-dynamic";

import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { ShopsAgentClient } from "./ShopsAgentClient";
import { agentShopsQueryKey, fetchAgentShops } from "@/lib/agents/shops-service";

export default async function ShopsAgentPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: agentShopsQueryKey,
    queryFn: fetchAgentShops,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ShopsAgentClient />
    </HydrationBoundary>
  );
}
