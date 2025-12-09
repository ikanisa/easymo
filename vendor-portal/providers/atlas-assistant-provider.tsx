"use client";

import { createContext, useContext, useMemo, useState, useEffect } from "react";

export interface AssistantContextPayload {
  title: string;
  subtitle?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

interface AtlasAssistantContextValue {
  context: AssistantContextPayload | null;
  setContext: (payload: AssistantContextPayload | null) => void;
}

const AtlasAssistantContext = createContext<AtlasAssistantContextValue | null>(null);

export function AtlasAssistantProvider({ children }: { children: React.ReactNode }) {
  const [context, setContextState] = useState<AssistantContextPayload | null>(null);

  const setContext = (payload: AssistantContextPayload | null) => {
    setContextState(payload);
  };

  const value = useMemo<AtlasAssistantContextValue>(() => ({ context, setContext }), [context]);

  useEffect(() => {
    if (!context) return;
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("atlas-assistant:context", {
        detail: context,
      })
    );
  }, [context]);

  return <AtlasAssistantContext.Provider value={value}>{children}</AtlasAssistantContext.Provider>;
}

export function useAtlasAssistant() {
  const ctx = useContext(AtlasAssistantContext);
  if (!ctx) {
    throw new Error("useAtlasAssistant must be used within an AtlasAssistantProvider");
  }
  return ctx;
}
