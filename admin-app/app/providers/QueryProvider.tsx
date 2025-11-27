"use client";

import {
  DehydratedState,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactNode, useState, useEffect } from "react";

import { getBrowserQueryClient } from "@/lib/api/queryClient";
import { persister } from "@/lib/query-client";

interface QueryProviderProps {
  children: ReactNode;
  state?: DehydratedState;
}

export function QueryProvider({ children, state }: QueryProviderProps) {
  const [queryClient] = useState<QueryClient>(() => getBrowserQueryClient());
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      setIsDesktop(true);
    }
  }, []);

  if (isDesktop) {
    return (
      <PersistQueryClientProvider 
        client={queryClient} 
        persistOptions={{ persister }}
      >
        <HydrationBoundary state={state}>{children}</HydrationBoundary>
      </PersistQueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ persister: undefined as any }} // Disable persistence for web if needed, or use localStorage persister
    >
      <HydrationBoundary state={state}>{children}</HydrationBoundary>
    </PersistQueryClientProvider>
  );
}
