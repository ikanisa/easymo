export const dynamic = "force-dynamic";

import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import {
  fetchPropertyListings,
  propertyQueryKeys,
} from "@/lib/queries/property-rentals";
import { PropertyRentalAgentClient } from "./PropertyRentalAgentClient";

export default async function PropertyRentalAgentPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: propertyQueryKeys.listings(),
    queryFn: fetchPropertyListings,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PropertyRentalAgentClient />
    </HydrationBoundary>
  );
}
