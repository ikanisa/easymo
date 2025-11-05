export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContributionsLedgerTable } from "@/components/baskets/ContributionsLedgerTable";
import {
  basketsQueryKeys,
  fetchContributions,
  type BasketsQueryParams,
} from "@/lib/queries/baskets";

const LEDGER_PARAMS: BasketsQueryParams = { limit: 100 };

export default async function BasketsContributionsPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: basketsQueryKeys.contributions(LEDGER_PARAMS),
    queryFn: () => fetchContributions(LEDGER_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <div className="admin-page">
      <PageHeader
        title="Contributions Ledger"
        description="Track allocations, cycle progress, and exports for every Ikimina."
      />
      <HydrationBoundary state={dehydratedState}>
        <ContributionsLedgerTable params={LEDGER_PARAMS} />
      </HydrationBoundary>
    </div>
  );
}
