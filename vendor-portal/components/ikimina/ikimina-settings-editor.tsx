"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import {
  IKIMINA_SETTINGS_INITIAL_STATE,
  SettingsActionState,
  updateIkiminaSettings,
} from "@/app/(main)/ikimina/actions";
import { Drawer } from "@/components/ui/drawer";
import { GlassCard } from "@/components/ui/glass-card";
import { FormField, FormLayout, FormSummaryBanner } from "@/components/ui/form";
import { canManageSettings } from "@/lib/permissions";
import { useProfileContext } from "@/providers/profile-provider";
import { useToast } from "@/providers/toast-provider";
import { useTranslation } from "@/providers/i18n-provider";

const FREQUENCIES = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Bi-weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM", label: "Custom" },
] as const;

type IkiminaSettings = {
  contribution?: {
    fixedAmount?: number | null;
    frequency?: string | null;
  } | null;
  enforcement?: {
    allowPartialPayments?: boolean | null;
    gracePeriodDays?: number | null;
    lateFeePercent?: number | null;
  } | null;
  notifications?: {
    smsReminders?: boolean | null;
    reminderDaysBefore?: number | null;
  } | null;
};

interface IkiminaSettingsEditorProps {
  ikiminaId: string;
  ikiminaName: string;
  saccoId: string | null;
  initialSettings: Record<string, unknown> | null;
  history?: Array<{
    id: string;
    action: string;
    actorLabel: string;
    createdAt: string;
    diff: Record<string, unknown> | null;
  }>;
}

type FieldState = {
  contributionFixedAmount: string;
  contributionFrequency: string;
  allowPartialPayments: boolean;
  gracePeriodDays: string;
  lateFeePercent: string;
  smsReminders: boolean;
  reminderDaysBefore: string;
};

export function IkiminaSettingsEditor({
  ikiminaId,
  ikiminaName,
  saccoId,
  initialSettings,
  history = [],
}: IkiminaSettingsEditorProps) {
  const { profile } = useProfileContext();
  const { success, error } = useToast();
  const { t } = useTranslation();

  const defaults = useMemo(() => {
    const settings = (initialSettings as IkiminaSettings | null) ?? null;
    const contribution = settings?.contribution ?? {};
    const enforcement = settings?.enforcement ?? {};
    const notifications = settings?.notifications ?? {};

    const fixedAmount = contribution?.fixedAmount ?? null;
    const frequency = contribution?.frequency ?? "MONTHLY";

    return {
      contributionFixedAmount: fixedAmount != null ? String(fixedAmount) : "",
      contributionFrequency: FREQUENCIES.some((item) => item.value === frequency)
        ? frequency
        : "MONTHLY",
      allowPartialPayments: enforcement?.allowPartialPayments ?? true,
      gracePeriodDays: String(enforcement?.gracePeriodDays ?? 5),
      lateFeePercent: String(enforcement?.lateFeePercent ?? 0),
      smsReminders: notifications?.smsReminders ?? true,
      reminderDaysBefore: String(notifications?.reminderDaysBefore ?? 2),
    } satisfies FieldState;
  }, [initialSettings]);

  const [fields, setFields] = useState<FieldState>(defaults);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [state, formAction, pending] = useActionState<SettingsActionState, FormData>(
    updateIkiminaSettings,
    IKIMINA_SETTINGS_INITIAL_STATE
  );

  useEffect(() => {
    if (state.status === "success") {
      success(`Settings updated / Amabwiriza yavuguruwe`);
    }
    if (state.status === "error" && state.message) {
      error(state.message);
    }
  }, [error, state, success]);

  const preview = useMemo(
    () => ({
      contribution: {
        frequency: fields.contributionFrequency,
        fixedAmount: fields.contributionFixedAmount ? Number(fields.contributionFixedAmount) : null,
      },
      enforcement: {
        allowPartialPayments: fields.allowPartialPayments,
        gracePeriodDays: Number(fields.gracePeriodDays || 0),
        lateFeePercent: Number(fields.lateFeePercent || 0),
      },
      notifications: {
        smsReminders: fields.smsReminders,
        reminderDaysBefore: Number(fields.reminderDaysBefore || 0),
      },
    }),
    [fields]
  );

  const canEdit = canManageSettings(profile, saccoId);

  const fieldErrors = state.fieldErrors ?? {};
  const controlClass =
    "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 placeholder:text-neutral-2 focus:outline-none focus:ring-2 focus:ring-rw-blue disabled:opacity-60";

  return (
    <GlassCard
      title={`${t("common.settings", "Settings")} · ${ikiminaName}`}
      subtitle={t(
        "ikimina.settings.subtitle",
        "Adjust contribution policies, enforcement rules, and reminders."
      )}
      actions={
        !canEdit ? (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">
            {t("common.readOnly", "Read only")}
          </span>
        ) : undefined
      }
    >
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="ikiminaId" value={ikiminaId} />

        <FormLayout variant="double" className="gap-6">
          <FormField
            label={t("ikimina.settings.contributionAmount", "Contribution amount")}
            inputId="contribution-fixed-amount"
            optionalLabel={t("common.optional", "Optional")}
            hint={t("ikimina.settings.contributionHint", "Leave blank for flexible contributions")}
            error={fieldErrors.contributionFixedAmount}
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                name="contributionFixedAmount"
                type="number"
                min={0}
                step="100"
                placeholder="e.g. 15000"
                value={fields.contributionFixedAmount}
                onChange={(event) =>
                  setFields((prev) => ({ ...prev, contributionFixedAmount: event.target.value }))
                }
                disabled={!canEdit || pending}
                className={controlClass}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
          <FormField
            label={t("ikimina.settings.frequency", "Frequency")}
            inputId="contribution-frequency"
            error={fieldErrors.contributionFrequency}
          >
            {({ id, describedBy }) => (
              <select
                id={id}
                name="contributionFrequency"
                value={fields.contributionFrequency}
                onChange={(event) =>
                  setFields((prev) => ({ ...prev, contributionFrequency: event.target.value }))
                }
                disabled={!canEdit || pending}
                className={controlClass}
                aria-describedby={describedBy}
              >
                {FREQUENCIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </FormLayout>

        <FormLayout variant="double" className="gap-6">
          <FormField
            label={t("ikimina.settings.allowPartial", "Allow partial payments")}
            inputId="allow-partial"
            description={t(
              "ikimina.settings.partialHint",
              "Let members contribute even if they can’t reach the full amount."
            )}
            className="md:col-span-2"
          >
            {({ id }) => (
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <input
                  id={id}
                  type="checkbox"
                  name="allowPartialPayments"
                  checked={fields.allowPartialPayments}
                  onChange={(event) =>
                    setFields((prev) => ({ ...prev, allowPartialPayments: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-white/30 bg-transparent"
                  disabled={!canEdit || pending}
                />
                <span className="text-sm text-neutral-0">
                  {fields.allowPartialPayments
                    ? t(
                        "ikimina.settings.partialEnabled",
                        "Members can pay smaller amounts and settle later."
                      )
                    : t(
                        "ikimina.settings.partialDisabled",
                        "Require the full contribution amount for each cycle."
                      )}
                </span>
              </div>
            )}
          </FormField>
          <FormField
            label={t("ikimina.settings.gracePeriod", "Grace period (days)")}
            inputId="grace-period"
            error={fieldErrors.gracePeriodDays}
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                name="gracePeriodDays"
                type="number"
                min={0}
                max={60}
                value={fields.gracePeriodDays}
                onChange={(event) =>
                  setFields((prev) => ({ ...prev, gracePeriodDays: event.target.value }))
                }
                disabled={!canEdit || pending}
                className={controlClass}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
          <FormField
            label={t("ikimina.settings.lateFee", "Late fee (%)")}
            inputId="late-fee"
            error={fieldErrors.lateFeePercent}
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                name="lateFeePercent"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={fields.lateFeePercent}
                onChange={(event) =>
                  setFields((prev) => ({ ...prev, lateFeePercent: event.target.value }))
                }
                disabled={!canEdit || pending}
                className={controlClass}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        </FormLayout>

        <FormLayout variant="double" className="gap-6">
          <FormField
            label={t("ikimina.settings.smsReminders", "Send SMS reminders")}
            inputId="sms-reminders"
            description={t(
              "ikimina.settings.remindersDescription",
              "Queue friendly reminders before contributions are due."
            )}
            className="md:col-span-1"
          >
            {({ id }) => (
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <input
                  id={id}
                  type="checkbox"
                  name="smsReminders"
                  checked={fields.smsReminders}
                  onChange={(event) =>
                    setFields((prev) => ({ ...prev, smsReminders: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-white/30 bg-transparent"
                  disabled={!canEdit || pending}
                />
                <span className="text-sm text-neutral-0">
                  {fields.smsReminders
                    ? t(
                        "ikimina.settings.remindersEnabled",
                        "Members receive reminder SMS messages."
                      )
                    : t(
                        "ikimina.settings.remindersDisabled",
                        "SMS reminders are disabled for this ikimina."
                      )}
                </span>
              </div>
            )}
          </FormField>
          <FormField
            label={t("ikimina.settings.reminderLead", "Reminder lead time")}
            inputId="reminder-lead"
            hint={t("ikimina.settings.reminderLeadHint", "Days before due date")}
            error={fieldErrors.reminderDaysBefore}
          >
            {({ id, describedBy }) => (
              <input
                id={id}
                name="reminderDaysBefore"
                type="number"
                min={0}
                max={30}
                value={fields.reminderDaysBefore}
                onChange={(event) =>
                  setFields((prev) => ({ ...prev, reminderDaysBefore: event.target.value }))
                }
                disabled={!canEdit || pending}
                className={controlClass}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        </FormLayout>

        {state.status === "error" && state.message && !state.fieldErrors ? (
          <FormSummaryBanner
            status="error"
            title={t("ikimina.settings.saveFailed", "Unable to save settings")}
            description={state.message}
          />
        ) : null}
        {state.status === "success" ? (
          <FormSummaryBanner
            status="success"
            title={state.message ?? t("ikimina.settings.saved", "Settings updated")}
            description={t(
              "ikimina.settings.syncMessage",
              "Updates propagate to member apps and automated reminders."
            )}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-full bg-kigali px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass transition hover:bg-[#ffe066] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canEdit || pending}
          >
            {pending ? t("common.saving", "Saving…") : t("common.save", "Save")}
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-0 transition hover:border-white/30 hover:text-neutral-0"
          >
            {t("ikimina.settings.openAdvanced", "Advanced settings")}
          </button>
          {!canEdit ? (
            <span className="text-xs text-neutral-3">
              {t(
                "ikimina.settings.readOnlyHint",
                "Only system admins or the assigned SACCO can edit these settings."
              )}
            </span>
          ) : null}
        </div>
      </form>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t("ikimina.settings.advancedTitle", "Advanced settings & history")}
        description={t(
          "ikimina.settings.advancedDescription",
          "Review the raw JSON payload and audit trail for compliance."
        )}
        size="lg"
      >
        <div className="space-y-6 text-neutral-0">
          <section>
            <h3 className="text-xs uppercase tracking-[0.3em] text-neutral-2">
              {t("ikimina.settings.previewJson", "Preview JSON")}
            </h3>
            <pre className="mt-2 max-h-[320px] overflow-x-auto rounded-2xl bg-black/40 p-4 text-xs text-neutral-2">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </section>
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-[0.3em] text-neutral-2">
              {t("ikimina.settings.recentUpdates", "Recent updates")}
            </h3>
            {history.length === 0 ? (
              <p className="text-xs text-neutral-3">
                {t("ikimina.settings.noHistory", "No prior settings updates recorded.")}
              </p>
            ) : (
              <ul className="space-y-3 text-sm text-neutral-0">
                {history.map((entry) => (
                  <li key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.3em] text-neutral-3">
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                      <span>{entry.actorLabel}</span>
                    </div>
                    <p className="mt-2 text-sm text-neutral-0">{entry.action}</p>
                    {entry.diff ? (
                      <pre className="mt-2 overflow-x-auto rounded-xl bg-black/40 p-3 text-[11px] text-neutral-2">
                        {JSON.stringify(entry.diff, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Drawer>
    </GlassCard>
  );
}
