export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { PageHeader } from "@/components/layout/PageHeader";
import { MembershipQueueTable } from "@/components/baskets/MembershipQueueTable";
import {
  basketsQueryKeys,
  fetchMemberships,
  type BasketsQueryParams,
} from "@/lib/queries/baskets";

const MEMBERSHIP_PARAMS: BasketsQueryParams = { limit: 100, status: 'pending' };

export default async function BasketsMembershipsPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: basketsQueryKeys.memberships(MEMBERSHIP_PARAMS),
    queryFn: () => fetchMemberships(MEMBERSHIP_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <div className="admin-page">
      <PageHeader
        title="Membership Management"
        description="Approve or remove members, enforce single-ikimina rule, and track committee roles."
      />
      <HydrationBoundary state={dehydratedState}>
        <MembershipQueueTable params={MEMBERSHIP_PARAMS} />
      </HydrationBoundary>
    </div>
  );
}
