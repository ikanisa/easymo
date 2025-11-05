export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { SaccoBranchesTable } from "@/components/baskets/SaccoBranchesTable";
import { SaccoOfficersTable } from "@/components/baskets/SaccoOfficersTable";
import {
  basketsQueryKeys,
  fetchSaccos,
  fetchSaccoOfficers,
  type BasketsQueryParams,
} from "@/lib/queries/baskets";

const BRANCH_PARAMS: BasketsQueryParams = { limit: 100 };
const OFFICER_PARAMS: BasketsQueryParams = { limit: 100 };

export default async function SaccoBranchesPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: basketsQueryKeys.saccos(BRANCH_PARAMS),
    queryFn: () => fetchSaccos(BRANCH_PARAMS),
  });

  await queryClient.prefetchQuery({
    queryKey: basketsQueryKeys.saccoOfficers(OFFICER_PARAMS),
    queryFn: () => fetchSaccoOfficers(OFFICER_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <div className="admin-page">
      <PageHeader
        title="SACCO Branches & Officers"
        description="Create branches, assign officers, and maintain contact details."
      />
      <HydrationBoundary state={dehydratedState}>
        <div className="space-y-8">
          <SaccoBranchesTable params={BRANCH_PARAMS} />
          <SaccoOfficersTable params={OFFICER_PARAMS} />
        </div>
      </HydrationBoundary>
    </div>
  );
}
