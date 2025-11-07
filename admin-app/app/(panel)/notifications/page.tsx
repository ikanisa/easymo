export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { NotificationsClient } from "./NotificationsClient";
import {
  fetchNotifications,
  notificationsQueryKeys,
  type NotificationsQueryParams,
} from "@/lib/queries/notifications";

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

