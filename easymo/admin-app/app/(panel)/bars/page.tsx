import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { BarsClient } from "./BarsClient";
import {
  barsQueryKeys,
  type BarsQueryParams,
  fetchBars,
} from "@/lib/queries/bars";
import {
  fetchStaffNumbers,
  staffNumbersQueryKeys,
  type StaffNumbersQueryParams,
} from "@/lib/queries/staffNumbers";

const DEFAULT_BAR_PARAMS: BarsQueryParams = { limit: 100 };
const DEFAULT_STAFF_PARAMS: StaffNumbersQueryParams = { limit: 6 };

export default async function BarsPage() {
  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: barsQueryKeys.list(DEFAULT_BAR_PARAMS),
      queryFn: () => fetchBars(DEFAULT_BAR_PARAMS),
    }),
    queryClient.prefetchQuery({
      queryKey: staffNumbersQueryKeys.list(DEFAULT_STAFF_PARAMS),
      queryFn: () => fetchStaffNumbers(DEFAULT_STAFF_PARAMS),
    }),
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <BarsClient
        initialBarParams={DEFAULT_BAR_PARAMS}
        staffNumbersParams={DEFAULT_STAFF_PARAMS}
      />
    </HydrationBoundary>
  );
}
