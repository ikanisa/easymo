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
import { isAdminUser } from "@/lib/auth/is-admin-user";

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
        if (data.session) {
          console.log("auth.session.loaded", { event: "SESSION_LOADED", userId: data.session.user.id });
        }
      })
      .catch((error) => {
        console.error("auth.session.load_failed", { error: error.message });
        if (!active) return;
        setStatus("unauthenticated");
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setStatus(nextSession ? "authenticated" : "unauthenticated");
      console.log("auth.state.changed", { event: "AUTH_STATE_CHANGED", authEvent: event, userId: nextSession?.user?.id });
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
      console.error("auth.signin.failed", { error: error?.message });
      throw error ?? new Error("Unable to sign in with Supabase credentials.");
    }
    setSession(data.session);
    setUser(data.user);
    setStatus("authenticated");
    console.log("auth.signin.success", { event: "USER_SIGNED_IN", userId: data.user.id });
    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    const userId = user?.id;
    const supabase = getSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("auth.signout.failed", { error: error.message });
      }
    }

    setSession(null);
    setUser(null);
    setStatus("unauthenticated");
    console.log("auth.signout.success", { event: "USER_SIGNED_OUT", userId });

    // Clear legacy admin session cookies if present
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch (error) {
      console.warn("legacy.logout.failed", error);
    }
  }, [user]);

  const refreshSession = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("auth.refresh.failed", { error: error.message });
      return null;
    }
    setSession(data.session ?? null);
    setUser(data.session?.user ?? null);
    setStatus(data.session ? "authenticated" : "unauthenticated");
    if (data.session) {
      console.log("auth.refresh.success", { event: "SESSION_REFRESHED" });
    }
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
