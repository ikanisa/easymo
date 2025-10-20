export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { LeadsClient } from "./LeadsClient";

export default async function LeadsPage() {
  const queryClient = createQueryClient();
  const dehydrated = dehydrate(queryClient);
  return (
    <HydrationBoundary state={dehydrated}>
      <LeadsClient />
    </HydrationBoundary>
  );
}
