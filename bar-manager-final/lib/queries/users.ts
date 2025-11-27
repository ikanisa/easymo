import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { type User, userSchema } from "@/lib/schemas";
import type { PaginatedResult } from "@/lib/shared/pagination";

export type UsersQueryParams = {
  search?: string;
  offset?: number;
  limit?: number;
};

const usersResponseSchema = z.object({
  data: z.array(userSchema),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

const usersKey = (params: UsersQueryParams) =>
  ["users", params] satisfies QueryKey;

export function fetchUsers(
  params: UsersQueryParams = { limit: 50 },
): Promise<PaginatedResult<User>> {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  return apiFetch<z.infer<typeof usersResponseSchema>>(
    `${getAdminApiPath("users")}?${searchParams.toString()}`,
  ).then((response) => usersResponseSchema.parse(response));
}

export function useUsersQuery(
  params: UsersQueryParams = { limit: 50 },
  options?: UseQueryOptions<
    PaginatedResult<User>,
    unknown,
    PaginatedResult<User>
  >,
) {
  return useQuery({
    queryKey: usersKey(params),
    queryFn: () => fetchUsers(params),
    ...options,
  });
}

export const usersQueryKeys = {
  list: (params: UsersQueryParams = { limit: 50 }) => usersKey(params),
} as const;
