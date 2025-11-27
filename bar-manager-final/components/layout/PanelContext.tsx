"use client";

import { createContext, useContext } from "react";

import type { OmniSearchResult } from "@/lib/omnisearch/types";

export type SidecarTab = "overview" | "logs" | "tasks" | "policies";

export interface SidecarState {
  open: boolean;
  tab: SidecarTab;
  entity: OmniSearchResult | null;
}

export interface PanelContextValue {
  commandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openSidecar: (entity: OmniSearchResult, tab?: SidecarTab) => void;
  closeSidecar: () => void;
  sidecarState: SidecarState;
  setSidecarTab: (tab: SidecarTab) => void;
}

const PanelContext = createContext<PanelContextValue | null>(null);

export function usePanelContext(): PanelContextValue {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error("usePanelContext must be used within PanelShell");
  }
  return context;
}

export const PanelContextProvider = PanelContext.Provider;
