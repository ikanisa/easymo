"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslation } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const supabase = getSupabaseBrowserClient();

export function OutreachAutomationCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const [hours, setHours] = useState<number>(48);
  const [pending, startTransition] = useTransition();
  const hoursLabel = useMemo(() => `${hours} ${t("common.hours", "hours")}`, [hours, t]);

  const runNow = () => {
    startTransition(async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/functions/v1/scheduled-reconciliation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ hours }),
      }).catch((e) => {
        toast.error(e?.message ?? t("common.networkError", "Network error"));
        return null;
      });
      if (!res) return;
      if (!res.ok) {
        const text = await res.text().catch(() => null);
        toast.error(
          text ?? t("admin.outreach.runFailed", "Failed to run scheduled reconciliation")
        );
        return;
      }
      const json = (await res.json()) as { queued?: number; checked?: number };
      const queued = json.queued ?? 0;
      const checked = json.checked ?? 0;
      const template = t(
        "admin.outreach.runOk",
        "Queued {{queued}} of {{checked}} pending payments for escalation."
      );
      const message = template
        .replace(/\{\{\s*queued\s*\}\}/g, String(queued))
        .replace(/\{\{\s*checked\s*\}\}/g, String(checked));
      toast.success(message);
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
        <p className="text-sm text-neutral-2">
          {t(
            "admin.outreach.description",
            "Escalate aged pending/unallocated payments to the notification queue for follow-up."
          )}
        </p>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-neutral-0">
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("admin.outreach.window", "Escalation window")}
          </span>
          <span className="inline-flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={14 * 24}
              value={hours}
              onChange={(e) =>
                setHours(Math.max(1, Math.min(14 * 24, Number(e.target.value) || 1)))
              }
              className="w-20 rounded-xl border border-white/10 bg-white/10 px-2 py-1 text-right"
            />
            <span className="text-xs text-neutral-2">{hoursLabel}</span>
          </span>
        </label>
      </div>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={runNow}
          disabled={pending}
          className="interactive-scale rounded-full bg-kigali px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass disabled:opacity-60"
        >
          {pending ? t("common.processing", "Processing…") : t("admin.outreach.runNow", "Run now")}
        </button>
      </div>
    </div>
  );
}
