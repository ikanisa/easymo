"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetAuthCache, updateAuthCacheScope } from "@/lib/offline/sync";

export function SupabaseAuthListener() {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep server-side auth state in sync for RSC/API calls.
      const shouldSyncSession =
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "PASSWORD_RECOVERY" ||
        event === "MFA_CHALLENGE_VERIFIED";

      if (shouldSyncSession) {
        void fetch("/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ event, session }),
        });
      }

      if (event === "SIGNED_OUT") {
        void fetch("/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ event, session: null }),
        });
      }

      // Update the offline cache's auth scope (from codex branch)
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        const credential = session?.access_token ?? session?.refresh_token ?? null;
        void updateAuthCacheScope(credential);
      }
      if (event === "SIGNED_OUT") {
        void updateAuthCacheScope(null);
      }

      // Bust high-priority caches when auth boundary changes (from main)
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "MFA_CHALLENGE_VERIFIED") {
        void resetAuthCache();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
