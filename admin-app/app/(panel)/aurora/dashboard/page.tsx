/**
 * Aurora Dashboard - Modernized dashboard using Aurora design system
 * This is the new world-class dashboard implementation
 */
export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { createPanelPageMetadata } from "@/components/layout/nav-items";
import { createQueryClient } from "@/lib/api/queryClient";
import { getDashboardSnapshot } from "@/lib/dashboard/dashboard-service";
import {
  dashboardQueryKeys,
  fetchDashboardWebhookErrors,
} from "@/lib/queries/dashboard";

import { AuroraDashboardClient } from "./AuroraDashboardClient";

export const metadata = createPanelPageMetadata("/aurora/dashboard");

export default async function AuroraDashboardPage() {
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
      <AuroraDashboardClient />
    </HydrationBoundary>
  );
}
