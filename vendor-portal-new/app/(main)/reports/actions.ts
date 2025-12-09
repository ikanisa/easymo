"use server";

import { revalidatePath } from "next/cache";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { logAudit } from "@/lib/audit";
import { instrumentServerAction } from "@/lib/observability/server-action";
import { logError, logInfo, logWarn, updateLogContext } from "@/lib/observability/logger";
import { computeNextRunUtc, mapSubscriptionRow, sanitizeFilters } from "./subscription-utils";
import type {
  ReportSubscription,
  ReportSubscriptionFilters,
  ReportSubscriptionFormat,
  ReportSubscriptionFrequency,
} from "./types";

export type ReportSubscriptionActionResult = {
  status: "success" | "error";
  message?: string;
  subscription?: ReportSubscription;
  id?: string;
};

type CreatePayload = {
  saccoId?: string | null;
  email: string;
  frequency: ReportSubscriptionFrequency;
  format: ReportSubscriptionFormat;
  deliveryHour: number;
  deliveryDay?: number | null;
  filters?: ReportSubscriptionFilters;
};

type TogglePayload = { id: string; isActive: boolean };
type DeletePayload = { id: string };

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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clampDay(value: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(value ?? NaN)) {
    return fallback;
  }
  return Math.trunc(value as number);
}

async function createReportSubscriptionInternal(
  payload: CreatePayload
): Promise<ReportSubscriptionActionResult> {
  const { profile, user } = await requireUserAndProfile();
  updateLogContext({ userId: user.id, saccoId: profile.sacco_id ?? null });

  const supabase = createSupabaseServiceRoleClient("reports/actions:create");

  const saccoId =
    profile.role === "SYSTEM_ADMIN"
      ? (payload.saccoId ?? profile.sacco_id ?? null)
      : profile.sacco_id;

  if (!saccoId) {
    logWarn("report_subscription_missing_sacco", { role: profile.role });
    return { status: "error", message: "SACCO context is required" };
  }

  if (!emailRegex.test(payload.email)) {
    return { status: "error", message: "Enter a valid email" };
  }

  const deliveryHour = Number.isFinite(payload.deliveryHour)
    ? Math.min(23, Math.max(0, Math.trunc(payload.deliveryHour)))
    : 6;

  let deliveryDay: number | null = null;
  if (payload.frequency === "WEEKLY") {
    deliveryDay = ((clampDay(payload.deliveryDay, new Date().getUTCDay()) % 7) + 7) % 7;
  } else if (payload.frequency === "MONTHLY") {
    const fallback = new Date().getUTCDate();
    const normalized = clampDay(payload.deliveryDay, fallback);
    deliveryDay = Math.min(28, Math.max(1, normalized));
  }

  const filters = sanitizeFilters(payload.filters);
  const nextRun = computeNextRunUtc(payload.frequency, deliveryHour, deliveryDay);

  const insertPayload = {
    sacco_id: saccoId,
    created_by: user.id,
    email: payload.email.trim(),
    frequency: payload.frequency,
    format: payload.format,
    delivery_hour: deliveryHour,
    delivery_day: deliveryDay,
    filters: { ...filters, saccoId },
    next_run_at: nextRun.toISOString(),
  } satisfies Record<string, unknown>;

  const { data, error } = await (supabase as any)
    .schema("app")
    .from("report_subscriptions")
    .insert(insertPayload)
    .select(
      "id, sacco_id, email, frequency, format, delivery_hour, delivery_day, filters, is_active, last_run_at, next_run_at, created_at"
    )
    .maybeSingle();

  if (error || !data) {
    logError("report_subscription_create_failed", { error, saccoId });
    return { status: "error", message: error?.message ?? "Failed to create subscription" };
  }

  const created = data as SubscriptionRow;

  await logAudit({
    action: "REPORT_SUBSCRIPTION_CREATED",
    entity: "REPORT_SUBSCRIPTION",
    entityId: created.id,
    diff: { saccoId, email: payload.email, frequency: payload.frequency, format: payload.format },
  });

  await revalidatePath("/reports");
  logInfo("report_subscription_created", { subscriptionId: created.id, saccoId });

  return { status: "success", subscription: mapSubscriptionRow(created) };
}

async function toggleReportSubscriptionInternal({
  id,
  isActive,
}: TogglePayload): Promise<ReportSubscriptionActionResult> {
  const { profile, user } = await requireUserAndProfile();
  updateLogContext({ userId: user.id, saccoId: profile.sacco_id ?? null });

  const supabase = createSupabaseServiceRoleClient("reports/actions:toggle");

  const { data: existing, error } = await (supabase as any)
    .schema("app")
    .from("report_subscriptions")
    .select(
      "id, sacco_id, email, frequency, format, delivery_hour, delivery_day, filters, is_active, last_run_at, next_run_at, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logError("report_subscription_toggle_load_failed", { error, id });
    return { status: "error", message: error.message ?? "Unable to load subscription" };
  }

  if (!existing) {
    return { status: "error", message: "Subscription not found" };
  }

  const existingRow = existing as SubscriptionRow;

  const nextRun = isActive
    ? computeNextRunUtc(
        existingRow.frequency,
        existingRow.delivery_hour ?? 6,
        existingRow.delivery_day ?? null
      ).toISOString()
    : existingRow.next_run_at;

  const { data: updatedRow, error: updateError } = await (supabase as any)
    .schema("app")
    .from("report_subscriptions")
    .update({ is_active: isActive, next_run_at: nextRun })
    .eq("id", id)
    .select(
      "id, sacco_id, email, frequency, format, delivery_hour, delivery_day, filters, is_active, last_run_at, next_run_at, created_at"
    )
    .maybeSingle();

  if (updateError || !updatedRow) {
    logError("report_subscription_toggle_failed", { id, isActive, error: updateError });
    return { status: "error", message: updateError?.message ?? "Failed to update subscription" };
  }

  const updated = updatedRow as SubscriptionRow;

  await logAudit({
    action: isActive ? "REPORT_SUBSCRIPTION_ENABLED" : "REPORT_SUBSCRIPTION_DISABLED",
    entity: "REPORT_SUBSCRIPTION",
    entityId: id,
    diff: { isActive },
  });

  await revalidatePath("/reports");
  logInfo("report_subscription_toggled", { id, isActive });

  return { status: "success", subscription: mapSubscriptionRow(updated) };
}

async function deleteReportSubscriptionInternal({
  id,
}: DeletePayload): Promise<ReportSubscriptionActionResult> {
  const { profile, user } = await requireUserAndProfile();
  updateLogContext({ userId: user.id, saccoId: profile.sacco_id ?? null });

  const supabase = createSupabaseServiceRoleClient("reports/actions:delete");

  const { error } = await (supabase as any)
    .schema("app")
    .from("report_subscriptions")
    .delete()
    .eq("id", id);

  if (error) {
    logError("report_subscription_delete_failed", { id, error });
    return { status: "error", message: error.message ?? "Failed to delete subscription" };
  }

  await logAudit({
    action: "REPORT_SUBSCRIPTION_DELETED",
    entity: "REPORT_SUBSCRIPTION",
    entityId: id,
    diff: null,
  });

  await revalidatePath("/reports");
  logInfo("report_subscription_deleted", { id });

  return { status: "success", id };
}

export const createReportSubscription = instrumentServerAction(
  "reports.createSubscription",
  createReportSubscriptionInternal
);

export const toggleReportSubscription = instrumentServerAction(
  "reports.toggleSubscription",
  toggleReportSubscriptionInternal
);

export const deleteReportSubscription = instrumentServerAction(
  "reports.deleteSubscription",
  deleteReportSubscriptionInternal
);
