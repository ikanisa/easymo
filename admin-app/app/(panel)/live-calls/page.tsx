import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { LiveCallsClient } from "./LiveCallsClient";

export default async function LiveCallsPage() {
  const queryClient = createQueryClient();
  const dehydrated = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydrated}>
      <LiveCallsClient />
    </HydrationBoundary>
  );
}
