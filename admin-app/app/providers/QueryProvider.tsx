"use client";

import { ReactNode, useState } from "react";
import {
  DehydratedState,
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { getBrowserQueryClient } from "@/lib/api/queryClient";

interface QueryProviderProps {
  children: ReactNode;
  state?: DehydratedState;
}

export function QueryProvider({ children, state }: QueryProviderProps) {
  const [queryClient] = useState<QueryClient>(() => getBrowserQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={state}>{children}</HydrationBoundary>
    </QueryClientProvider>
  );
}
