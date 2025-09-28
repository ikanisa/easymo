import { QueryClient } from '@tanstack/react-query';

const DEFAULT_QUERY_OPTIONS = {
  queries: {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: (failureCount: number, error: unknown) => {
      if (failureCount >= 2) return false;
      if (typeof window === 'undefined') return false;
      return true;
    }
  }
} as const;

export function createQueryClient() {
  return new QueryClient({ defaultOptions: DEFAULT_QUERY_OPTIONS });
}

let browserQueryClient: QueryClient | null = null;

export function getBrowserQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return createQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }
  return browserQueryClient;
}
