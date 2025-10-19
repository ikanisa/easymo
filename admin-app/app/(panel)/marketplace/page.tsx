import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { MarketplaceClient } from "./MarketplaceClient";

export default async function MarketplacePage() {
  const queryClient = createQueryClient();
  const dehydrated = dehydrate(queryClient);
  return (
    <HydrationBoundary state={dehydrated}>
      <MarketplaceClient />
    </HydrationBoundary>
  );
}
