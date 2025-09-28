import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { StaffNumbersClient } from "./StaffNumbersClient";
import {
  fetchStaffNumbers,
  staffNumbersQueryKeys,
  type StaffNumbersQueryParams,
} from "@/lib/queries/staffNumbers";

const DEFAULT_PARAMS: StaffNumbersQueryParams = { limit: 200 };

export default async function StaffNumbersPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: staffNumbersQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchStaffNumbers(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <StaffNumbersClient initialParams={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}
