export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoansTable } from "@/components/baskets/LoansTable";
import {
  basketsQueryKeys,
  fetchLoans,
  type BasketsQueryParams,
} from "@/lib/queries/baskets";

const LOAN_PARAMS: BasketsQueryParams = { limit: 100, status: 'pending' };

export default async function BasketsLoansPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: basketsQueryKeys.loans(LOAN_PARAMS),
    queryFn: () => fetchLoans(LOAN_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <div className="admin-page">
      <PageHeader
        title="Loan Requests & Approvals"
        description="Track member loan requests, committee endorsements, and SACCO decisions."
      />
      <HydrationBoundary state={dehydratedState}>
        <LoansTable params={LOAN_PARAMS} />
      </HydrationBoundary>
    </div>
  );
}
