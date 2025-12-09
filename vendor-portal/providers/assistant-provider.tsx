"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { logWarn } from "@/lib/observability/logger";

const STORAGE_PREFIX = "atlas.assistant" as const;
const OPEN_STORAGE_KEY = `${STORAGE_PREFIX}.open` as const;

const buildVisibilityKey = (path: string) => `${STORAGE_PREFIX}.visible:${path}`;

const getInitialOpenState = () => {
  if (typeof window === "undefined") {
    return false;
  }
  const stored = window.localStorage.getItem(OPEN_STORAGE_KEY);
  return stored === "true";
};

const readLocalVisibility = (path: string) => {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(buildVisibilityKey(path));
  if (stored === null) {
    return null;
  }
  return stored === "true";
};

const writeLocalVisibility = (path: string, value: boolean) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(buildVisibilityKey(path), String(value));
};

const writeLocalOpen = (value: boolean) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(OPEN_STORAGE_KEY, String(value));
};

const randomId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `assistant-${Math.random().toString(36).slice(2, 10)}`;
};

export type AssistantTrend = "up" | "down" | "flat";

export interface AssistantEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
  iconLabel?: string;
}

export interface AssistantFilter {
  label: string;
  value: string;
  active?: boolean;
}

export interface AssistantSelection {
  id: string;
  label: string;
  subtitle?: string;
}

export interface AssistantMetric {
  label: string;
  value: string;
  change?: string;
  trend?: AssistantTrend;
}

export interface AssistantContextSnapshot {
  entity?: AssistantEntity | null;
  filters: AssistantFilter[];
  selections: AssistantSelection[];
  metrics: AssistantMetric[];
}

export interface AssistantActionDefinition {
  id?: string;
  label: string;
  description?: string;
  onSelect: () => void | Promise<void>;
  shortcut?: string;
}

export interface AssistantAction extends AssistantActionDefinition {
  id: string;
}

interface AssistantContextValue {
  context: AssistantContextSnapshot;
  setEntity: (entity: AssistantEntity | null) => void;
  setFilters: (filters: AssistantFilter[]) => void;
  setSelections: (selections: AssistantSelection[]) => void;
  setMetrics: (metrics: AssistantMetric[]) => void;
  resetContext: () => void;
  registerActions: (actions: AssistantActionDefinition[]) => () => void;
  actions: AssistantAction[];
  isOpen: boolean;
  setOpen: (next: boolean) => void;
  toggleOpen: () => void;
  isAssistantVisible: boolean;
  setAssistantVisible: (next: boolean) => Promise<void>;
  isVisibilityLoading: boolean;
  isSyncingVisibility: boolean;
}

const DEFAULT_SNAPSHOT: AssistantContextSnapshot = {
  entity: null,
  filters: [],
  selections: [],
  metrics: [],
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

async function fetchRemoteVisibility(path: string, signal: AbortSignal): Promise<boolean | null> {
  try {
    const response = await fetch(`/api/assistant/preferences?path=${encodeURIComponent(path)}`, {
      signal,
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { visible?: unknown };
    if (typeof payload.visible === "boolean") {
      return payload.visible;
    }
    return null;
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") {
      return null;
    }
    logWarn("assistant.visibility.fetch_failed", { error });
    return null;
  }
}

async function persistRemoteVisibility(path: string, visible: boolean) {
  try {
    const response = await fetch("/api/assistant/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, visible }),
    });
    if (!response.ok) {
      logWarn("assistant.visibility.persist_failed", {
        response: await response.text(),
        status: response.status,
      });
    }
  } catch (error) {
    logWarn("assistant.visibility.persist_failed", { error });
  }
}

interface AssistantProviderProps {
  children: ReactNode;
}

export function AssistantProvider({ children }: AssistantProviderProps) {
  const pathname = usePathname() ?? "/";
  const [context, setContext] = useState<AssistantContextSnapshot>(DEFAULT_SNAPSHOT);
  const [actions, setActions] = useState<AssistantAction[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(() => getInitialOpenState());
  const [isAssistantVisible, setIsAssistantVisible] = useState<boolean>(false);
  const [isVisibilityLoading, setIsVisibilityLoading] = useState<boolean>(true);
  const [isSyncingVisibility, setIsSyncingVisibility] = useState<boolean>(false);

  useEffect(() => {
    setContext(DEFAULT_SNAPSHOT);
    setActions([]);
  }, [pathname]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const local = readLocalVisibility(pathname);

    setIsVisibilityLoading(true);
    setIsAssistantVisible(local ?? false);

    fetchRemoteVisibility(pathname, controller.signal).then((remote) => {
      if (!mounted) return;
      if (typeof remote === "boolean") {
        setIsAssistantVisible(remote);
        writeLocalVisibility(pathname, remote);
      } else if (local !== null) {
        writeLocalVisibility(pathname, local);
      }
      setIsVisibilityLoading(false);
    });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [pathname]);

  useEffect(() => {
    if (!isAssistantVisible && isOpen) {
      setIsOpen(false);
    }
  }, [isAssistantVisible, isOpen]);

  useEffect(() => {
    writeLocalOpen(isOpen);
  }, [isOpen]);

  const setAssistantVisible = useCallback(
    async (next: boolean) => {
      const path = pathname;
      setIsAssistantVisible(next);
      writeLocalVisibility(path, next);
      if (!next) {
        setIsOpen(false);
      }
      setIsSyncingVisibility(true);
      await persistRemoteVisibility(path, next);
      setIsSyncingVisibility(false);
    },
    [pathname]
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "a" && (event.metaKey || event.ctrlKey) && event.shiftKey) {
        event.preventDefault();
        if (!isAssistantVisible) {
          void setAssistantVisible(true);
          return;
        }
        setIsOpen((prev) => !prev);
      }
      if (event.key.toLowerCase() === "p" && (event.metaKey || event.ctrlKey) && event.shiftKey) {
        event.preventDefault();
        void setAssistantVisible(!isAssistantVisible);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isAssistantVisible, setAssistantVisible]);

  const setEntity = useCallback((entity: AssistantEntity | null) => {
    setContext((prev) => ({ ...prev, entity }));
  }, []);

  const setFilters = useCallback((filters: AssistantFilter[]) => {
    setContext((prev) => ({ ...prev, filters }));
  }, []);

  const setSelections = useCallback((selections: AssistantSelection[]) => {
    setContext((prev) => ({ ...prev, selections }));
  }, []);

  const setMetrics = useCallback((metrics: AssistantMetric[]) => {
    setContext((prev) => ({ ...prev, metrics }));
  }, []);

  const resetContext = useCallback(() => {
    setContext(DEFAULT_SNAPSHOT);
  }, []);

  const registerActions = useCallback((definitions: AssistantActionDefinition[]) => {
    const entries: AssistantAction[] = definitions.map((definition) => ({
      ...definition,
      id: definition.id ?? randomId(),
    }));

    setActions((prev) => {
      const next = [...prev];
      for (const entry of entries) {
        next.push(entry);
      }
      return next;
    });

    return () => {
      setActions((prev) =>
        prev.filter((action) => !entries.some((entry) => entry.id === action.id))
      );
    };
  }, []);

  const value = useMemo<AssistantContextValue>(
    () => ({
      context,
      setEntity,
      setFilters,
      setSelections,
      setMetrics,
      resetContext,
      registerActions,
      actions,
      isOpen,
      setOpen: setIsOpen,
      toggleOpen: () => setIsOpen((prev) => !prev),
      isAssistantVisible,
      setAssistantVisible,
      isVisibilityLoading,
      isSyncingVisibility,
    }),
    [
      context,
      setEntity,
      setFilters,
      setSelections,
      setMetrics,
      resetContext,
      registerActions,
      actions,
      isOpen,
      isAssistantVisible,
      setAssistantVisible,
      isVisibilityLoading,
      isSyncingVisibility,
    ]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error("useAssistant must be used within an AssistantProvider");
  }
  return context;
}

export function useAssistantContext() {
  const { context, setEntity, setFilters, setSelections, setMetrics, resetContext } =
    useAssistant();
  return { context, setEntity, setFilters, setSelections, setMetrics, resetContext };
}

export function useAssistantActions() {
  const { registerActions, actions } = useAssistant();
  return { registerActions, actions };
}
