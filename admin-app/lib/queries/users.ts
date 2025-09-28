import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { listUsers, type PaginatedResult } from '@/lib/data-provider';
import type { User } from '@/lib/schemas';

export type UsersQueryParams = {
  search?: string;
  offset?: number;
  limit?: number;
};

const usersKey = (params: UsersQueryParams) => ['users', params] satisfies QueryKey;

export function fetchUsers(params: UsersQueryParams = { limit: 50 }): Promise<PaginatedResult<User>> {
  return listUsers(params);
}

export function useUsersQuery(
  params: UsersQueryParams = { limit: 50 },
  options?: UseQueryOptions<PaginatedResult<User>, unknown, PaginatedResult<User>>
) {
  return useQuery({
    queryKey: usersKey(params),
    queryFn: () => fetchUsers(params),
    ...options
  });
}

export const usersQueryKeys = {
  list: (params: UsersQueryParams = { limit: 50 }) => usersKey(params)
} as const;
