import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/api/queryClient';
import {
  dashboardQueryKeys,
  fetchDashboardSnapshot,
  fetchDashboardOrderEvents,
  fetchDashboardWebhookErrors
} from '@/lib/queries/dashboard';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({ queryKey: dashboardQueryKeys.snapshot(), queryFn: fetchDashboardSnapshot }),
    queryClient.prefetchQuery({ queryKey: dashboardQueryKeys.orderEvents(), queryFn: fetchDashboardOrderEvents }),
    queryClient.prefetchQuery({ queryKey: dashboardQueryKeys.webhookErrors(), queryFn: fetchDashboardWebhookErrors })
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
