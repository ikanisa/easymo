export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { createPanelPageMetadata } from "@/components/layout/nav-items";
import { createQueryClient } from "@/lib/api/queryClient";
import {
  dashboardQueryKeys,
  fetchDashboardWebhookErrors,
} from "@/lib/queries/dashboard";
import {
  fetchNotifications,
  notificationsQueryKeys,
  type NotificationsQueryParams,
} from "@/lib/queries/notifications";

import { WhatsAppHealthClient } from "./WhatsAppHealthClient";

export const metadata = createPanelPageMetadata("/whatsapp-health");

const DEFAULT_NOTIFICATION_PARAMS: NotificationsQueryParams = { limit: 200 };

export default async function WhatsAppHealthPage() {
  const queryClient = createQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: notificationsQueryKeys.list(DEFAULT_NOTIFICATION_PARAMS),
      queryFn: () => fetchNotifications(DEFAULT_NOTIFICATION_PARAMS),
    }),
    queryClient.prefetchQuery({
      queryKey: dashboardQueryKeys.webhookErrors(),
      queryFn: fetchDashboardWebhookErrors,
    }),
  ]);

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <WhatsAppHealthClient
        initialNotificationParams={DEFAULT_NOTIFICATION_PARAMS}
      />
    </HydrationBoundary>
  );
}

