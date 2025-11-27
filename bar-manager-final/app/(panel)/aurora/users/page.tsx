/**
 * Aurora Users Page - Modernized users management
 */
export const dynamic = 'force-dynamic';

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { createPanelPageMetadata } from "@/components/layout/nav-items";
import { createQueryClient } from "@/lib/api/queryClient";
import {
  usersQueryKeys,
  type UsersQueryParams,
} from "@/lib/queries/users";
import { listUsers } from "@/lib/users/users-service";

import { AuroraUsersClient } from "./AuroraUsersClient";

export const metadata = createPanelPageMetadata("/aurora/users");

const DEFAULT_PARAMS: UsersQueryParams = { limit: 200 };

export default async function AuroraUsersPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: usersQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => listUsers(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <AuroraUsersClient initialParams={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}
