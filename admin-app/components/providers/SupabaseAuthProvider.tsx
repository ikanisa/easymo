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
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase-client";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type SupabaseAuthContextValue = {
  user: User | null;
  session: Session | null;
  status: AuthStatus;
  isAdmin: boolean;
  signInWithPassword: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null);

function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  const role = (user.app_metadata as Record<string, unknown> | undefined)?.role;
  const roles = (user.app_metadata as Record<string, unknown> | undefined)?.roles;
  const userRole = (user.user_metadata as Record<string, unknown> | undefined)?.role;
  const userRoles = (user.user_metadata as Record<string, unknown> | undefined)?.roles;

  const normalize = (value: unknown) => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) {
      return (value as unknown[]).filter((entry): entry is string => typeof entry === "string");
    }
    return [];
  };

  const allRoles = [
    ...normalize(role),
    ...normalize(userRole),
    ...normalize(roles),
    ...normalize(userRoles),
  ];

  return allRoles.some((value) => value.toLowerCase() === "admin");
}

interface SupabaseAuthProviderProps {
  children: ReactNode;
}

export function SupabaseAuthProvider({ children }: SupabaseAuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSession(null);
      setUser(null);
      setStatus("unauthenticated");
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        setStatus(data.session ? "authenticated" : "unauthenticated");
      })
      .catch((error) => {
        console.error("supabase.auth.getSession.failed", error);
        if (!active) return;
        setStatus("unauthenticated");
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setStatus(nextSession ? "authenticated" : "unauthenticated");
    });

    return () => {
      active = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase is not configured in this environment.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      throw error ?? new Error("Unable to sign in with Supabase credentials.");
    }
    setSession(data.session);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("supabase.auth.signOut_failed", error);
      }
    }

    setSession(null);
    setUser(null);
    setStatus("unauthenticated");

    // Clear legacy admin session cookies if present
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch (error) {
      console.warn("legacy.logout.failed", error);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("supabase.auth.refresh_failed", error.message);
      return null;
    }
    setSession(data.session ?? null);
    setUser(data.session?.user ?? null);
    setStatus(data.session ? "authenticated" : "unauthenticated");
    return data.session ?? null;
  }, []);

  const value = useMemo<SupabaseAuthContextValue>(() => ({
    user,
    session,
    status,
    isAdmin: isAdminUser(user),
    signInWithPassword,
    signOut,
    refreshSession,
  }), [refreshSession, session, signInWithPassword, signOut, status, user]);

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error("useSupabaseAuth must be used within a SupabaseAuthProvider");
  }
  return context;
}
