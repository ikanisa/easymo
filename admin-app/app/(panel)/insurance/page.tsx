export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import {
  fetchInsuranceQuotes,
  insuranceQueryKeys,
  type InsuranceQueryParams,
} from "@/lib/queries/insurance";
import { InsuranceClient } from "./InsuranceClient";

const DEFAULT_PARAMS: InsuranceQueryParams = { limit: 100 };

export default async function InsurancePage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: insuranceQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchInsuranceQuotes(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <InsuranceClient initialParams={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}

export const runtime = "edge";
