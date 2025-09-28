import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import { listQrTokens, type PaginatedResult } from '@/lib/data-provider';
import type { QrToken } from '@/lib/schemas';

export type QrTokensQueryParams = {
  limit?: number;
  offset?: number;
  printed?: boolean;
};

const qrKey = (params: QrTokensQueryParams) => ['qr-tokens', params] satisfies QueryKey;

export function fetchQrTokens(
  params: QrTokensQueryParams = { limit: 100 }
): Promise<PaginatedResult<QrToken>> {
  return listQrTokens(params);
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
