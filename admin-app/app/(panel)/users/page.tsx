export const dynamic = 'force-dynamic';

import { createPanelPageMetadata } from "@/components/layout/nav-items";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import { UsersClient } from "./UsersClient";
import {
  fetchUsers,
  usersQueryKeys,
  type UsersQueryParams,
} from "@/lib/queries/users";

export const metadata = createPanelPageMetadata("/users");

const DEFAULT_PARAMS: UsersQueryParams = { limit: 200 };

export default async function UsersPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: usersQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchUsers(DEFAULT_PARAMS),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <UsersClient initialParams={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}

