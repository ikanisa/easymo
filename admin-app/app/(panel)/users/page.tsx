import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/api/queryClient';
import { UsersClient } from './UsersClient';
import { usersQueryKeys, fetchUsers, type UsersQueryParams } from '@/lib/queries/users';

const DEFAULT_PARAMS: UsersQueryParams = { limit: 200 };

export default async function UsersPage() {
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: usersQueryKeys.list(DEFAULT_PARAMS),
    queryFn: () => fetchUsers(DEFAULT_PARAMS)
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <UsersClient initialParams={DEFAULT_PARAMS} />
    </HydrationBoundary>
  );
}
