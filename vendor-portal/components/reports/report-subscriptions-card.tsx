"use client";

import { useMemo, useState, useTransition } from "react";
import type { SaccoSearchResult } from "@/components/saccos/sacco-search-combobox";
import { type ReportFiltersChange } from "@/components/reports/report-filters";
import { useTranslation } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import {
  createReportSubscription,
  deleteReportSubscription,
  toggleReportSubscription,
} from "@/app/(main)/reports/actions";
import type { ReportSubscription } from "@/app/(main)/reports/types";

interface ReportSubscriptionsCardProps {
  filters: ReportFiltersChange;
  subscriptions: ReportSubscription[];
  saccoOptions: SaccoSearchResult[];
  isSystemAdmin: boolean;
  defaultSaccoId: string | null;
}

const WEEKDAY_OPTIONS: Array<{ value: number; key: string }> = [
  { value: 1, key: "common.weekday.monday" },
  { value: 2, key: "common.weekday.tuesday" },
  { value: 3, key: "common.weekday.wednesday" },
  { value: 4, key: "common.weekday.thursday" },
  { value: 5, key: "common.weekday.friday" },
  { value: 6, key: "common.weekday.saturday" },
  { value: 0, key: "common.weekday.sunday" },
];

const FREQUENCY_OPTIONS: Array<{ value: ReportSubscription["frequency"]; key: string }> = [
  { value: "DAILY", key: "common.frequency.daily" },
  { value: "WEEKLY", key: "common.frequency.weekly" },
  { value: "MONTHLY", key: "common.frequency.monthly" },
];

const FORMAT_OPTIONS: Array<{ value: ReportSubscription["format"]; key: string }> = [
  { value: "PDF", key: "common.format.pdf" },
  { value: "CSV", key: "common.format.csv" },
];

export function ReportSubscriptionsCard({
  filters,
  subscriptions: initialSubscriptions,
  saccoOptions,
  isSystemAdmin,
  defaultSaccoId,
}: ReportSubscriptionsCardProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState<ReportSubscription[]>(initialSubscriptions);
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<ReportSubscription["frequency"]>("WEEKLY");
  const [format, setFormat] = useState<ReportSubscription["format"]>("PDF");
  const [time, setTime] = useState("06:00");
  const [weeklyDay, setWeeklyDay] = useState<number>(new Date().getUTCDay());
  const [monthlyDay, setMonthlyDay] = useState<number>(1);
  const [selectedSacco, setSelectedSacco] = useState<string | null>(defaultSaccoId);
  const [pending, startTransition] = useTransition();

  const saccoLookup = useMemo(
    () => new Map(saccoOptions.map((option) => [option.id, option.name])),
    [saccoOptions]
  );

  const derivedSaccoId = isSystemAdmin ? selectedSacco : defaultSaccoId;

  const handleCreate = () => {
    if (!derivedSaccoId) {
      toast.error(t("reports.automations.saccoRequired", "Select a SACCO for this schedule"));
      return;
    }

    if (!email.trim()) {
      toast.error(t("reports.automations.emailRequired", "Enter a recipient email"));
      return;
    }

    const [hourString] = time.split(":");
    const deliveryHour = Number.parseInt(hourString ?? "6", 10);
    const deliveryDay =
      frequency === "WEEKLY" ? weeklyDay : frequency === "MONTHLY" ? monthlyDay : null;

    startTransition(async () => {
      const result = await createReportSubscription({
        saccoId: derivedSaccoId,
        email: email.trim(),
        frequency,
        format,
        deliveryHour,
        deliveryDay,
        filters: {
          saccoId: filters.sacco?.id ?? derivedSaccoId,
          from: filters.from || null,
          to: filters.to || null,
        },
      });

      if (result.status === "error" || !result.subscription) {
        toast.error(
          result.message ?? t("reports.automations.createFailed", "Failed to create subscription")
        );
        return;
      }

      setItems((previous) => [result.subscription!, ...previous]);
      setEmail("");
      toast.success(t("reports.automations.created", "Subscription created"));
    });
  };

  const handleToggle = (subscription: ReportSubscription) => {
    startTransition(async () => {
      const result = await toggleReportSubscription({
        id: subscription.id,
        isActive: !subscription.isActive,
      });
      if (result.status === "error" || !result.subscription) {
        toast.error(
          result.message ?? t("reports.automations.updateFailed", "Failed to update subscription")
        );
        return;
      }
      setItems((previous) =>
        previous.map((item) => (item.id === subscription.id ? result.subscription! : item))
      );
      toast.success(
        result.subscription.isActive
          ? t("reports.automations.resumed", "Subscription resumed")
          : t("reports.automations.paused", "Subscription paused")
      );
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(t("reports.automations.deleteConfirm", "Remove this subscription?"))) {
      return;
    }
    startTransition(async () => {
      const result = await deleteReportSubscription({ id });
      if (result.status === "error") {
        toast.error(
          result.message ?? t("reports.automations.deleteFailed", "Failed to delete subscription")
        );
        return;
      }
      setItems((previous) => previous.filter((item) => item.id !== id));
      toast.success(t("reports.automations.deleted", "Subscription removed"));
    });
  };

  const renderSchedule = (subscription: ReportSubscription) => {
    const nextRun = subscription.nextRunAt ? new Date(subscription.nextRunAt) : null;
    const lastRun = subscription.lastRunAt ? new Date(subscription.lastRunAt) : null;
    return (
      <div className="grid gap-2 text-[11px] text-neutral-3 sm:grid-cols-2">
        <span>
          {t("reports.automations.nextRun", "Next run")}:{" "}
          {nextRun ? nextRun.toLocaleString() : t("common.notAvailable", "N/A")}
        </span>
        <span>
          {t("reports.automations.lastRun", "Last run")}:{" "}
          {lastRun ? lastRun.toLocaleString() : t("common.notAvailable", "N/A")}
        </span>
      </div>
    );
  };

  const renderFilters = (subscription: ReportSubscription) => {
    const summary: string[] = [];
    const saccoName = saccoLookup.get(subscription.saccoId);
    if (saccoName) {
      summary.push(saccoName);
    }
    if (subscription.filters.from || subscription.filters.to) {
      summary.push(`${subscription.filters.from ?? "…"} → ${subscription.filters.to ?? "…"}`);
    }
    return summary.join(" • ");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
        <div className="space-y-3">
          <label className="space-y-1 text-sm text-neutral-0">
            <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
              {t("common.email", "Email")}
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="finance@sacco.rw"
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
            />
          </label>
          {isSystemAdmin && (
            <label className="space-y-1 text-sm text-neutral-0">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("table.sacco", "SACCO")}
              </span>
              <select
                value={selectedSacco ?? ""}
                onChange={(event) => setSelectedSacco(event.target.value || null)}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              >
                <option value="">
                  {t("reports.automations.saccoPlaceholder", "Select SACCO")}
                </option>
                {saccoOptions.map((sacco) => (
                  <option key={sacco.id} value={sacco.id}>
                    {sacco.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="text-xs text-neutral-3">
            {t(
              "reports.automations.filtersHint",
              "Subscriptions reuse the filters above for SACCO and date range."
            )}
          </p>
        </div>
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-0">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
              {t("reports.automations.frequency", "Frequency")}
            </span>
            <select
              value={frequency}
              onChange={(event) =>
                setFrequency(event.target.value as ReportSubscription["frequency"])
              }
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.key, option.value)}
                </option>
              ))}
            </select>
          </label>
          {frequency === "WEEKLY" && (
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("reports.automations.dayOfWeek", "Day of week")}
              </span>
              <select
                value={weeklyDay}
                onChange={(event) => setWeeklyDay(Number.parseInt(event.target.value, 10))}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              >
                {WEEKDAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.key, option.key)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {frequency === "MONTHLY" && (
            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("reports.automations.dayOfMonth", "Day of month")}
              </span>
              <input
                type="number"
                min={1}
                max={28}
                value={monthlyDay}
                onChange={(event) =>
                  setMonthlyDay(
                    Math.min(28, Math.max(1, Number.parseInt(event.target.value, 10) || 1))
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              />
            </label>
          )}
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
              {t("reports.automations.time", "Delivery time (UTC)")}
            </span>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {FORMAT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormat(option.value)}
                className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                  format === option.value
                    ? "bg-kigali text-ink shadow-glass"
                    : "border border-white/15 text-neutral-0"
                }`}
              >
                {t(option.key, option.value)}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending}
              className="interactive-scale rounded-full bg-kigali px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass disabled:opacity-60"
            >
              {pending
                ? t("common.saving", "Saving…")
                : t("reports.automations.create", "Create subscription")}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">
          {items.length} {t("reports.automations.count", "subscription(s)")}
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-2">
            {t("reports.automations.empty", "No scheduled exports yet.")}
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((subscription) => (
              <div
                key={subscription.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold">{subscription.email}</h4>
                    <p className="text-[11px] text-neutral-3">{renderFilters(subscription)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-white/15 px-2 py-1 text-neutral-0">
                      {t(
                        `common.frequency.${subscription.frequency.toLowerCase()}`,
                        subscription.frequency
                      )}
                    </span>
                    <span className="rounded-full border border-white/15 px-2 py-1 text-neutral-0">
                      {t(`common.format.${subscription.format.toLowerCase()}`, subscription.format)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-3">
                  <span>
                    {subscription.isActive
                      ? t("common.active", "Active")
                      : t("reports.automations.statusPaused", "Paused")}
                  </span>
                  <span>•</span>
                  <span>
                    {t("reports.automations.deliveryHour", "Hour")}: {subscription.deliveryHour}:00
                  </span>
                </div>
                <div className="mt-3 space-y-2">{renderSchedule(subscription)}</div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggle(subscription)}
                    disabled={pending}
                    className="rounded-full border border-white/15 px-3 py-1 uppercase tracking-[0.2em] text-neutral-0 disabled:opacity-60"
                  >
                    {subscription.isActive
                      ? t("reports.automations.pause", "Pause")
                      : t("reports.automations.resume", "Resume")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(subscription.id)}
                    disabled={pending}
                    className="rounded-full border border-white/15 px-3 py-1 uppercase tracking-[0.2em] text-red-300 disabled:opacity-60"
                  >
                    {t("reports.automations.delete", "Remove")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
