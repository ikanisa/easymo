export const dynamic = "force-dynamic";

import { dehydrate,HydrationBoundary } from "@tanstack/react-query";

import { agentShopsQueryKey, fetchAgentShops } from "@/lib/agents/shops-service";
import { createQueryClient } from "@/lib/api/queryClient";

import { ShopsAgentClient } from "./ShopsAgentClient";

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
