import { QueryClient, dehydrate, hydrate } from "@tanstack/react-query";

const DEFAULT_QUERY_OPTIONS = {
  queries: {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: (failureCount: number, error: unknown) => {
      if (failureCount >= 2) return false;
      if (typeof window === "undefined") return false;
      return true;
    },
  },
} as const;

export function createQueryClient() {
  return new QueryClient({ defaultOptions: DEFAULT_QUERY_OPTIONS });
}

let browserQueryClient: QueryClient | null = null;

export function getBrowserQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return createQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();

    // Lightweight persistence using localStorage with async wrappers
    const STORAGE_KEY = "admin-app.rq-cache.v1";
    const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.ts && Date.now() - parsed.ts < MAX_AGE_MS && parsed.state) {
          hydrate(browserQueryClient!, parsed.state);
        } else if (parsed && parsed.ts) {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (_error) {
      // Ignore hydration errors
    }

    let saveScheduled = false;
    const scheduleSave = () => {
      if (saveScheduled) return;
      saveScheduled = true;
      // Micro-throttle to batch rapid updates
      setTimeout(() => {
        saveScheduled = false;
        try {
          const state = dehydrate(browserQueryClient!);
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ts: Date.now(), state })
          );
        } catch (_error) {
          // Ignore persistence errors (quota, etc.)
        }
      }, 250);
    };

    // Persist on cache changes
    browserQueryClient!.getQueryCache().subscribe(scheduleSave);
  }
  return browserQueryClient;
}
