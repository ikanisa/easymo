"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useTranslation } from "@/providers/i18n-provider";
import { cn } from "@/lib/utils";

interface SignOutButtonProps {
  className?: string;
  variant?: "default" | "ghost";
}

export function SignOutButton({ className, variant = "default" }: SignOutButtonProps) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);

  const handleSignOut = useCallback(async () => {
    if (pending) {
      return;
    }

    setPending(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("auth.signOut.failed", error);
      }

      try {
        await fetch("/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ event: "SIGNED_OUT", session: null }),
        });
      } catch (syncError) {
        console.error("auth.signOut.sync_failed", syncError);
      }

      router.replace("/");
      router.refresh();
    } catch (unknownError) {
      console.error("auth.signOut.unknown", unknownError);
    } finally {
      setPending(false);
    }
  }, [pending, router, supabase]);

  return (
    <button
      type="button"
      onClick={() => {
        void handleSignOut();
      }}
      className={cn(
        "interactive-scale inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold tracking-[0.1em] transition disabled:cursor-not-allowed disabled:opacity-70",
        variant === "ghost"
          ? "border border-transparent text-neutral-3 hover:text-neutral-0"
          : "border border-white/10 text-neutral-0 hover:border-white/25 hover:text-neutral-0",
        className
      )}
      disabled={pending}
      aria-live="polite"
      aria-busy={pending}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      <span>{pending ? t("nav.signingOut", "Signing out…") : t("nav.signOut", "Sign out")}</span>
    </button>
  );
}
