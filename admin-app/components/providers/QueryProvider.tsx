'use client';

import { ReactNode } from 'react';
import { QueryClientProvider, HydrationBoundary, DehydratedState } from '@tanstack/react-query';
import { getBrowserQueryClient } from '@/lib/api/queryClient';

interface QueryProviderProps {
  children: ReactNode;
  state?: DehydratedState;
}

export function QueryProvider({ children, state }: QueryProviderProps) {
  const queryClient = getBrowserQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={state}>{children}</HydrationBoundary>
    </QueryClientProvider>
  );
}
