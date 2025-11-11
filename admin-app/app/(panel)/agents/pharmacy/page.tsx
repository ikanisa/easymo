export const dynamic = "force-dynamic";

import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import {
  fetchPharmacyRequests,
  pharmacyQueryKeys,
} from "@/lib/queries/pharmacy";
import { PharmacyAgentClient } from "./PharmacyAgentClient";

export default async function PharmacyAgentPage() {
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery({
    queryKey: pharmacyQueryKeys.requests(),
    queryFn: fetchPharmacyRequests,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PharmacyAgentClient />
    </HydrationBoundary>
  );
}
