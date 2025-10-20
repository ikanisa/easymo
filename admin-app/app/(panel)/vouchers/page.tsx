export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { VouchersClient } from "./VouchersClient";
import {
  fetchVouchers,
  vouchersQueryKeys,
  type VouchersQueryParams,
} from "@/lib/queries/vouchers";

const DEFAULT_PARAMS: VouchersQueryParams = { limit: 200 };

export default async function VouchersPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: vouchersQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchVouchers(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <VouchersClient initialParams={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}
