export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { IbiminaRegistryTable } from "@/components/baskets/IbiminaRegistryTable";
import {
  basketsQueryKeys,
  fetchIbimina,
  type BasketsQueryParams,
} from "@/lib/queries/baskets";

const LIST_PARAMS: BasketsQueryParams = { limit: 100 };

export default async function IbiminaRegistryPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: basketsQueryKeys.ibimina(LIST_PARAMS),
    queryFn: () => fetchIbimina(LIST_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <div className="admin-page">
      <PageHeader
        title="Ibimina Registry"
        description="View and manage Ibimina by SACCO branch, status, and onboarding stage."
      />
      <HydrationBoundary state={dehydratedState}>
        <IbiminaRegistryTable params={LIST_PARAMS} />
      </HydrationBoundary>
    </div>
  );
}
