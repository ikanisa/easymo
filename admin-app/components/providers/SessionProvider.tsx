"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

export type AdminSession = {
  actorId: string;
  label: string | null;
  expiresAt: string;
};

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type SessionContextValue = {
  session: AdminSession | null;
  status: SessionStatus;
  refresh: () => Promise<AdminSession | null>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  initialSession: AdminSession | null;
  children: ReactNode;
}

declare global {
  interface Window {
    __ADMIN_SESSION__?: { actorId: string; label: string | null };
  }
}

export function SessionProvider({ initialSession, children }: SessionProviderProps) {
  const router = useRouter();
  const baseFetchRef = useRef<typeof fetch>();
  const [session, setSession] = useState<AdminSession | null>(initialSession);
  const [status, setStatus] = useState<SessionStatus>(
    initialSession ? "authenticated" : "unauthenticated",
  );
  const refreshPromiseRef = useRef<Promise<AdminSession | null> | null>(null);

  const applySession = useCallback((next: AdminSession | null) => {
    setSession(next);
    setStatus(next ? "authenticated" : "unauthenticated");
    if (typeof window !== "undefined") {
      if (next) {
        window.__ADMIN_SESSION__ = { actorId: next.actorId, label: next.label };
      } else {
        delete window.__ADMIN_SESSION__;
      }
    }
  }, []);

  useEffect(() => {
    applySession(initialSession ?? null);
  }, [initialSession, applySession]);

  const handleSessionExpired = useCallback(() => {
    applySession(null);
    router.replace("/login");
    router.refresh();
  }, [applySession, router]);

  const refresh = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const task = (async () => {
      try {
        const res = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (res.status === 401) {
          handleSessionExpired();
          return null;
        }
        if (!res.ok) {
          throw new Error(`Failed to refresh session – ${res.status}`);
        }
        const payload = (await res.json()) as AdminSession;
        applySession(payload);
        return payload;
      } catch (error) {
        console.error("session.refresh_failed", error);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = task;
    return task;
  }, [applySession, handleSessionExpired]);

  const signOut = useCallback(async () => {
    try {
      const fetcher = baseFetchRef.current ?? fetch;
      await fetcher("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch (error) {
      console.error("session.sign_out_failed", error);
    } finally {
      handleSessionExpired();
    }
  }, [handleSessionExpired]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!baseFetchRef.current) {
      baseFetchRef.current = window.fetch.bind(window);
    }
    const originalFetch = baseFetchRef.current;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const actorId = session?.actorId;

      const enrichRequest = (info: RequestInfo | URL, options: RequestInit = {}) => {
        if (!actorId) return { info, options };

        const url =
          typeof info === "string"
            ? info
            : info instanceof URL
              ? info.toString()
              : info instanceof Request
                ? info.url
                : String(info);

        let sameOrigin = false;
        try {
          const parsed = new URL(url, window.location.origin);
          sameOrigin = parsed.origin === window.location.origin;
        } catch (error) {
          sameOrigin = false;
        }

        if (!sameOrigin) {
          return { info, options };
        }

        if (info instanceof Request) {
          const headers = new Headers(info.headers);
          if (!headers.has("x-actor-id")) {
            headers.set("x-actor-id", actorId);
          }
          return {
            info: new Request(info, { headers }),
            options,
          };
        }

        const headers = new Headers(options.headers ?? {});
        if (!headers.has("x-actor-id")) {
          headers.set("x-actor-id", actorId);
        }
        return {
          info,
          options: { ...options, headers },
        };
      };

      const { info, options } = enrichRequest(input, init ?? {});
      const response = await originalFetch(info as RequestInfo, options);
      if (response.status === 401) {
        handleSessionExpired();
      } else if (response.headers.get("x-admin-session-refreshed") === "true") {
        void refresh();
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [session?.actorId, refresh, handleSessionExpired]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onFocus = () => {
      void refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const contextValue = useMemo<SessionContextValue>(() => ({
    session,
    status,
    refresh,
    signOut,
  }), [session, status, refresh, signOut]);

  return <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>;
}

export function useAdminSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useAdminSession must be used within a SessionProvider");
  }
  return context;
}
