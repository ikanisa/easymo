import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { PaginatedResult } from '@/lib/data-provider';
import { mockQrTokens } from '@/lib/mock-data';
import type { QrToken } from '@/lib/schemas';

export type QrTokensQueryParams = {
  limit?: number;
  offset?: number;
  printed?: boolean;
  stationId?: string;
};

const qrKey = (params: QrTokensQueryParams) => ['qr-tokens', params] satisfies QueryKey;

export async function fetchQrTokens(
  params: QrTokensQueryParams = { limit: 100 }
): Promise<PaginatedResult<QrToken>> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));
  if (params.printed !== undefined) searchParams.set('printed', params.printed ? 'true' : 'false');
  if (params.stationId) searchParams.set('stationId', params.stationId);

  const response = await apiFetch<{ data: QrToken[]; total: number; hasMore?: boolean }>(`/api/qr?${searchParams.toString()}`);
  if (response.ok) {
    const { data, total, hasMore } = response.data;
    return {
      data,
      total,
      hasMore: hasMore ?? ((params.offset ?? 0) + data.length < total)
    };
  }

  const offset = params.offset ?? 0;
  const limit = params.limit ?? mockQrTokens.length;
  const slice = mockQrTokens.slice(offset, offset + limit);
  return { data: slice, total: mockQrTokens.length, hasMore: offset + slice.length < mockQrTokens.length };
}

export function useQrTokensQuery(
  params: QrTokensQueryParams = { limit: 100 },
  options?: UseQueryOptions<PaginatedResult<QrToken>, unknown, PaginatedResult<QrToken>>
) {
  return useQuery({
    queryKey: qrKey(params),
    queryFn: () => fetchQrTokens(params),
    ...options
  });
}

export const qrQueryKeys = {
  list: (params: QrTokensQueryParams = { limit: 100 }) => qrKey(params)
} as const;
