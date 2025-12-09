import type {
  ReportSubscription,
  ReportSubscriptionFilters,
  ReportSubscriptionFormat,
  ReportSubscriptionFrequency,
} from "./types";

const WEEK_DAYS = 7;
const MAX_MONTH_DAY = 28;

export function sanitizeFilters(value: unknown): ReportSubscriptionFilters {
  if (!value || typeof value !== "object") {
    return {};
  }
  const record = value as Record<string, unknown>;
  const filters: ReportSubscriptionFilters = {};
  if (typeof record.saccoId === "string") {
    filters.saccoId = record.saccoId;
  }
  if (typeof record.from === "string") {
    filters.from = record.from;
  }
  if (typeof record.to === "string") {
    filters.to = record.to;
  }
  return filters;
}

export function computeNextRunUtc(
  frequency: ReportSubscriptionFrequency,
  deliveryHour: number,
  deliveryDay: number | null,
  now = new Date()
): Date {
  const hour = Number.isFinite(deliveryHour)
    ? Math.min(23, Math.max(0, Math.trunc(deliveryHour)))
    : 6;
  const base = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0, 0)
  );

  if (frequency === "DAILY") {
    if (base <= now) {
      base.setUTCDate(base.getUTCDate() + 1);
    }
    return base;
  }

  if (frequency === "WEEKLY") {
    const targetDay = deliveryDay ?? now.getUTCDay();
    const normalized = ((targetDay % WEEK_DAYS) + WEEK_DAYS) % WEEK_DAYS;
    const current = now.getUTCDay();
    let delta = normalized - current;
    if (delta < 0 || (delta === 0 && base <= now)) {
      delta += WEEK_DAYS;
    }
    base.setUTCDate(base.getUTCDate() + delta);
    return base;
  }

  // MONTHLY default
  const target = deliveryDay ? Math.min(MAX_MONTH_DAY, Math.max(1, Math.trunc(deliveryDay))) : 1;
  base.setUTCDate(target);
  if (base <= now) {
    const month = now.getUTCMonth() + 1;
    base.setUTCMonth(month);
    const daysInNextMonth = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)
    ).getUTCDate();
    base.setUTCDate(Math.min(target, daysInNextMonth));
  }
  return base;
}

type SubscriptionRow = {
  id: string;
  sacco_id: string;
  email: string;
  frequency: ReportSubscriptionFrequency;
  format: ReportSubscriptionFormat;
  delivery_hour: number | null;
  delivery_day: number | null;
  filters: unknown;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
};

export function mapSubscriptionRow(row: SubscriptionRow): ReportSubscription {
  return {
    id: row.id,
    saccoId: row.sacco_id,
    email: row.email,
    frequency: row.frequency,
    format: row.format,
    deliveryHour: row.delivery_hour ?? 6,
    deliveryDay: row.delivery_day ?? null,
    filters: sanitizeFilters(row.filters),
    isActive: row.is_active,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at,
  };
}
