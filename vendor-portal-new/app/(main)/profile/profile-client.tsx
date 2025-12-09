"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/providers/i18n-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/providers/toast-provider";
import { logError } from "@/lib/observability/logger";

const supabase = getSupabaseBrowserClient();

interface ProfileClientProps {
  email: string;
}

export function ProfileClient({ email }: ProfileClientProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { success, error } = useToast();
  const [checkedSession, setCheckedSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, startUpdatingPassword] = useTransition();

  useEffect(() => {
    const verifySession = async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) {
        router.replace("/");
        return;
      }
      setCheckedSession(true);
    };

    void verifySession();
  }, [router]);

  const onUpdatePassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password || !confirmPassword) {
      error(t("profile.password.required", "Provide a new password"));
      return;
    }

    if (password !== confirmPassword) {
      error(t("profile.password.mismatch", "Passwords do not match"));
      return;
    }

    startUpdatingPassword(async () => {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        logError("profile.update_failed", { error: updateError });
        error(
          updateError.message ?? t("profile.password.updateFailed", "Unable to update password")
        );
        return;
      }

      success(t("profile.password.updated", "Password updated"));
      setPassword("");
      setConfirmPassword("");
    });
  };

  if (!checkedSession) {
    return (
      <div className="flex items-center gap-2 text-neutral-11">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>{t("profile.loading", "Loading your profile…")}</span>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <GlassCard className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-atlas-blue" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-neutral-12">
              {t("profile.auth.title", "Authentication managed by Supabase")}
            </p>
            <p className="text-sm text-neutral-11">
              {t(
                "profile.auth.copy",
                "Legacy MFA and device login screens have been removed. Access is now governed by Supabase sessions."
              )}
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-neutral-1/60 px-4 py-3 text-sm text-neutral-12">
          <p className="font-medium">{t("profile.email", "Email")}</p>
          <p className="text-neutral-11">{email}</p>
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-atlas-blue" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-neutral-12">
              {t("profile.password.title", "Update password")}
            </p>
            <p className="text-sm text-neutral-11">
              {t("profile.password.helper", "Use a strong password to secure your account.")}
            </p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={onUpdatePassword}>
          <label className="space-y-2 text-sm text-neutral-12">
            <span>{t("profile.password.label", "New password")}</span>
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("profile.password.placeholder", "Enter a new password")}
              required
            />
          </label>
          <label className="space-y-2 text-sm text-neutral-12">
            <span>{t("profile.password.confirm", "Confirm password")}</span>
            <Input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t("profile.password.confirmPlaceholder", "Repeat the password")}
              required
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-atlas-blue px-4 py-2 text-sm font-semibold text-neutral-0 transition hover:bg-atlas-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
            disabled={updatingPassword}
          >
            {updatingPassword ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t("profile.password.saving", "Updating password…")}
              </>
            ) : (
              t("profile.password.save", "Save password")
            )}
          </button>
        </form>
      </GlassCard>
    </section>
  );
}
