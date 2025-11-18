export const dynamic = 'force-dynamic';

import { createPanelPageMetadata } from "@/components/layout/nav-items";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import {
  dashboardQueryKeys,
  fetchDashboardWebhookErrors,
} from "@/lib/queries/dashboard";
import { getDashboardSnapshot } from "@/lib/dashboard/dashboard-service";
import { DashboardClient } from "./DashboardClient";

export const metadata = createPanelPageMetadata("/dashboard");

export default async function DashboardPage() {
  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: dashboardQueryKeys.snapshot(),
      queryFn: getDashboardSnapshot,
    }),
    queryClient.prefetchQuery({
      queryKey: dashboardQueryKeys.webhookErrors(),
      queryFn: fetchDashboardWebhookErrors,
    }),
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
