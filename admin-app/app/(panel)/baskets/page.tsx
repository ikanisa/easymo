export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { BasketsClient } from "@/components/baskets/BasketsClient";
import {
  basketsQueryKeys,
  fetchIbimina,
  fetchSaccos,
  type BasketsQueryParams,
} from "@/lib/queries/baskets";

const SACCO_PARAMS: BasketsQueryParams = { limit: 20 };
const IBIMINA_PARAMS: BasketsQueryParams = { limit: 20 };

export default async function BasketsPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: basketsQueryKeys.saccos(SACCO_PARAMS),
    queryFn: () => fetchSaccos(SACCO_PARAMS),
  });

  await queryClient.prefetchQuery({
    queryKey: basketsQueryKeys.ibimina(IBIMINA_PARAMS),
    queryFn: () => fetchIbimina(IBIMINA_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <BasketsClient saccoParams={SACCO_PARAMS} ibiminaParams={IBIMINA_PARAMS} />
    </HydrationBoundary>
  );
}

