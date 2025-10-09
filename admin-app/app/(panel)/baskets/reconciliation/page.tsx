import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { UnmatchedSmsTable } from "@/components/baskets/UnmatchedSmsTable";
import {
  basketsQueryKeys,
  fetchUnmatchedSms,
  type BasketsQueryParams,
} from "@/lib/queries/baskets";

const UNMATCHED_PARAMS: BasketsQueryParams = { limit: 100, status: 'open' };

export default async function BasketsReconciliationPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: basketsQueryKeys.unmatchedSms(UNMATCHED_PARAMS),
    queryFn: () => fetchUnmatchedSms(UNMATCHED_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <div className="admin-page">
      <PageHeader
        title="Unmatched SMS Reconciliation"
        description="Resolve MoMo SMS that could not be automatically allocated to members."
      />
      <HydrationBoundary state={dehydratedState}>
        <UnmatchedSmsTable params={UNMATCHED_PARAMS} />
      </HydrationBoundary>
    </div>
  );
}
