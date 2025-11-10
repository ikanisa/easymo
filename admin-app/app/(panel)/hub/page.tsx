export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { adminHubQueryKeys, fetchAdminHubSnapshot } from "@/lib/queries/adminHub";
import { isFeatureFlagEnabled } from "@/lib/flags";
import { HubClient } from "./HubClient";

export default async function HubPage() {
  if (!isFeatureFlagEnabled("adminHubV2")) {
    redirect("/dashboard");
  }

  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: adminHubQueryKeys.snapshot(),
    queryFn: fetchAdminHubSnapshot,
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <HubClient />
    </HydrationBoundary>
  );
}
