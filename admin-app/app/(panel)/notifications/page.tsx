export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { createPanelPageMetadata } from "@/components/layout/nav-items";
import { createQueryClient } from "@/lib/api/queryClient";
import {
  fetchNotifications,
  notificationsQueryKeys,
  type NotificationsQueryParams,
} from "@/lib/queries/notifications";

import { NotificationsClient } from "./NotificationsClient";

export const metadata = createPanelPageMetadata("/notifications");

const DEFAULT_PARAMS: NotificationsQueryParams = { limit: 200 };

export default async function NotificationsPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: notificationsQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchNotifications(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <NotificationsClient initialParams={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}

