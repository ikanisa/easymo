/**
 * Loading State Hook
 * Provides consistent loading state management across pages
 */

'use client';

import { useCallback,useState } from 'react';

interface LoadingState {
  isLoading: boolean;
  error: Error | null;
  startLoading: () => void;
  stopLoading: () => void;
  setError: (error: Error | null) => void;
  withLoading: <T>(fn: () => Promise<T>) => Promise<T>;
}

export function useLoadingState(initialLoading = false): LoadingState {
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [error, setError] = useState<Error | null>(null);

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  const withLoading = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    startLoading();
    try {
      const result = await fn();
      stopLoading();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      stopLoading();
      throw error;
    }
  }, [startLoading, stopLoading]);

  return {
    isLoading,
    error,
    startLoading,
    stopLoading,
    setError,
    withLoading,
  };
}

/**
 * Data Fetching Hook with Loading State
 */
export function useDataFetch<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const { isLoading, error, withLoading } = useLoadingState(true);

  const refetch = useCallback(async () => {
    const result = await withLoading(fetchFn);
    setData(result);
    return result;
  }, [fetchFn, withLoading]);

  // Auto-fetch on mount and when deps change
  useState(() => {
    refetch();
  });

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
