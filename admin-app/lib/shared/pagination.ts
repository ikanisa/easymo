export type Pagination = {
  offset?: number;
  limit?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  hasMore: boolean;
};

export function paginateArray<T>(
  items: T[],
  { offset = 0, limit = 25 }: Pagination = {},
): PaginatedResult<T> {
  const slice = items.slice(offset, offset + limit);
  return {
    data: slice,
    total: items.length,
    hasMore: offset + limit < items.length,
  };
}
