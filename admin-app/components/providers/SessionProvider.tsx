"use client";

import { createContext, useContext, ReactNode } from "react";

export type AdminSessionContext = {
  actorId: string;
  label: string | null;
};

const SessionContext = createContext<AdminSessionContext | null>(null);

interface SessionProviderProps {
  session: AdminSessionContext;
  children: ReactNode;
}

export function SessionProvider({ session, children }: SessionProviderProps) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useAdminSession(): AdminSessionContext {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useAdminSession must be used within a SessionProvider");
  }
  return context;
}
