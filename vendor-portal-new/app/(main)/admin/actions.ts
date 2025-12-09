"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { supabaseSrv } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { logAudit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/performance/cache";
import { instrumentServerAction } from "@/lib/observability/server-action";
import { logError, logInfo, logWarn, updateLogContext } from "@/lib/observability/logger";
import { guardAdminAction } from "@/lib/admin/guard";
import crypto from "node:crypto";
import { requireUserAndProfile } from "@/lib/auth";

export type AdminActionResult = {
  status: "success" | "error";
  message?: string;
};

async function updateUserAccessInternal({
  userId,
  role,
  saccoId,
}: {
  userId: string;
  role: Database["public"]["Enums"]["app_role"];
  saccoId: string | null;
}): Promise<AdminActionResult> {
  const guard = await guardAdminAction<AdminActionResult>(
    {
      action: "admin_update_access",
      reason: "Only system administrators can modify user access.",
      logEvent: "admin_update_access_denied",
      metadata: { targetUserId: userId },
    },
    (error) => ({ status: "error", message: error.message })
  );

  if (guard.denied) {
    return guard.result;
  }

  const { supabase } = guard.context;
  const updatePayload: Database["public"]["Tables"]["users"]["Update"] = {
    role,
    sacco_id: saccoId,
  };

  // The Supabase JS client currently narrows update payloads to `never` when schema includes
  // custom views; cast locally until the generated types catch up.

  const { error } = await (supabase as any).from("users").update(updatePayload).eq("id", userId);

  if (error) {
    logError("admin_update_access_failed", { targetUserId: userId, error });
    return { status: "error", message: error.message ?? "Failed to update user" };
  }

  await revalidatePath("/admin");
  logInfo("admin_update_access_success", { targetUserId: userId, role, saccoId });
  return { status: "success", message: "User access updated" };
}

export const updateUserAccess = instrumentServerAction(
  "admin.updateUserAccess",
  updateUserAccessInternal
);

async function resetUserPasswordInternal({
  userId,
  email,
}: {
  userId: string;
  email?: string | null;
}): Promise<AdminActionResult & { temporaryPassword?: string }> {
  const guard = await guardAdminAction<AdminActionResult & { temporaryPassword?: string }>(
    {
      action: "admin_reset_user_password",
      reason: "Only system administrators can reset staff passwords.",
      logEvent: "admin_reset_user_password_denied",
      metadata: { targetUserId: userId },
    },
    (error) => ({ status: "error", message: error.message })
  );

  if (guard.denied) return guard.result;

  const { supabase, user: _actor } = guard.context;
  const temporaryPassword = crypto
    .randomBytes(12)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 16);

  try {
    const admin = (supabase as any).auth.admin;
    const { error: updateError } = await admin.updateUserById(userId, {
      password: temporaryPassword,
      user_metadata: { pw_reset_required: true },
    });
    if (updateError) {
      return { status: "error", message: updateError.message ?? "Failed to reset password" };
    }

    // Attempt to send an email via webhook if configured (optional)
    try {
      const url = process.env.EMAIL_WEBHOOK_URL;
      const key = process.env.EMAIL_WEBHOOK_KEY;
      if (url && email) {
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(key ? { Authorization: `Bearer ${key}` } : {}),
          },
          body: JSON.stringify({
            to: email,
            subject: "Your temporary password",
            html: `<p>Hello,</p><p>Your password has been reset. Temporary password: <b>${temporaryPassword}</b></p><p>Please sign in and set a new password immediately.</p>`,
          }),
        }).catch(() => void 0);
      }
    } catch {
      // ignore email failures; UI will still surface temporaryPassword
    }

    // Audit log (best effort)
    try {
      await logAudit({
        action: "USER_PASSWORD_RESET",
        entity: "users",
        entityId: userId,
        diff: { reset: true },
      });
    } catch {}

    return { status: "success", message: "Password reset", temporaryPassword };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Reset failed" };
  }
}

export const resetUserPassword = instrumentServerAction(
  "admin.resetUserPassword",
  resetUserPasswordInternal
);

async function toggleUserSuspensionInternal({
  userId,
  suspended,
}: {
  userId: string;
  suspended?: boolean;
}): Promise<AdminActionResult & { suspended?: boolean }> {
  const guard = await guardAdminAction<AdminActionResult & { suspended?: boolean }>(
    {
      action: "admin_toggle_user_suspension",
      reason: "Only system administrators can suspend staff.",
      logEvent: "admin_toggle_user_suspension_denied",
      metadata: { targetUserId: userId },
    },
    (error) => ({ status: "error", message: error.message })
  );
  if (guard.denied) return guard.result;

  const { supabase, user: _actor } = guard.context;

  // Determine current value if not provided
  let next = suspended;
  if (typeof next !== "boolean") {
    const { data, error } = await (supabase as any)
      .from("users")
      .select("suspended")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      return { status: "error", message: error.message ?? "Unable to read suspension state" };
    }
    next = !Boolean(data?.suspended);
  }

  const { error: updateError } = await (supabase as any)
    .from("users")
    .update({ suspended: next })
    .eq("id", userId);
  if (updateError) {
    return { status: "error", message: updateError.message ?? "Failed to update suspension" };
  }

  try {
    await logAudit({
      action: "USER_SUSPENSION_UPDATED",
      entity: "users",
      entityId: userId,
      diff: { suspended: next },
    });
  } catch {}

  return {
    status: "success",
    message: next ? "User suspended" : "User reactivated",
    suspended: next,
  };
}

export const toggleUserSuspension = instrumentServerAction(
  "admin.toggleUserSuspension",
  toggleUserSuspensionInternal
);

async function backfillOrgMembershipsInternal(): Promise<AdminActionResult & { count?: number }> {
  const guard = await guardAdminAction<AdminActionResult & { count?: number }>(
    {
      action: "admin_backfill_org_memberships",
      reason: "Only system administrators can run backfills.",
      logEvent: "admin_backfill_org_memberships_denied",
    },
    (error) => ({ status: "error", message: error.message })
  );
  if (guard.denied) return guard.result;

  const { supabase } = guard.context;
  // Load users with a SACCO assignment

  const { data, error } = await (supabase as any)
    .from("users")
    .select("id, role, sacco_id")
    .not("sacco_id", "is", null);
  if (error) return { status: "error", message: error.message ?? "Failed to load users" };

  const rows = (data ?? []) as Array<{
    id: string;
    role: Database["public"]["Enums"]["app_role"];
    sacco_id: string;
  }>;
  let count = 0;
  for (const row of rows) {
    const res = await (supabase as any)
      .schema("app")
      .from("org_memberships")
      .upsert(
        { user_id: row.id, org_id: row.sacco_id, role: row.role },
        { onConflict: "user_id,org_id" }
      );
    if (!res.error) count += 1;
  }

  return { status: "success", message: "Backfill complete", count };
}

export const backfillOrgMemberships = instrumentServerAction(
  "admin.backfillOrgMemberships",
  backfillOrgMembershipsInternal
);

async function queueNotificationInternal({
  saccoId,
  templateId,
  event = "SMS_TEMPLATE_TEST",
  testMsisdn,
}: {
  saccoId: string;
  templateId: string;
  event?: string;
  testMsisdn?: string | null;
}): Promise<AdminActionResult> {
  const guard = await guardAdminAction<AdminActionResult>(
    {
      action: "admin_queue_notification",
      reason: "Only system administrators can queue notifications.",
      logEvent: "admin_queue_notification_denied",
      metadata: { saccoId, templateId, event },
    },
    (error) => ({ status: "error", message: error.message })
  );

  if (guard.denied) {
    return guard.result;
  }

  const { supabase, user } = guard.context;

  let normalizedRecipient: string | null = null;
  if (testMsisdn && testMsisdn.trim().length > 0) {
    const digits = testMsisdn.replace(/[^0-9+]/g, "");
    if (digits.startsWith("+")) {
      normalizedRecipient = digits;
    } else if (digits.startsWith("2507")) {
      normalizedRecipient = `+${digits}`;
    } else if (digits.startsWith("07")) {
      normalizedRecipient = `+250${digits.slice(2)}`;
    } else {
      normalizedRecipient = digits;
    }
  }

  const { error } = await (supabase as any).from("notification_queue").insert({
    event,
    channel: "WHATSAPP",
    sacco_id: saccoId,
    payload: { templateId, queuedBy: user.id, to: normalizedRecipient },
    scheduled_for: new Date().toISOString(),
  });

  if (error) {
    logError("admin_queue_notification_failed", { saccoId, templateId, event, error });
    return { status: "error", message: error.message ?? "Failed to queue notification" };
  }

  logInfo("admin_queue_notification_success", { saccoId, templateId, event });
  return { status: "success", message: "Notification queued" };
}

async function createSmsTemplateInternal({
  saccoId,
  name,
  body,
  description,
  tokens,
}: {
  saccoId: string;
  name: string;
  body: string;
  description?: string | null;
  tokens?: string[];
}): Promise<
  AdminActionResult & { template?: Database["public"]["Tables"]["sms_templates"]["Row"] }
> {
  const guard = await guardAdminAction<
    AdminActionResult & { template?: Database["public"]["Tables"]["sms_templates"]["Row"] }
  >(
    {
      action: "admin_template_create",
      reason: "Only system administrators can create templates.",
      logEvent: "admin_template_create_denied",
      metadata: { saccoId },
    },
    (error) => ({ status: "error", message: error.message })
  );

  if (guard.denied) {
    return guard.result;
  }

  const { supabase } = guard.context;

  if (!name.trim() || !body.trim()) {
    logWarn("admin_template_create_invalid_payload", {
      saccoId,
      hasName: Boolean(name.trim()),
      hasBody: Boolean(body.trim()),
    });
    return { status: "error", message: "Template name and body are required." };
  }
  const payload: Database["public"]["Tables"]["sms_templates"]["Insert"] = {
    sacco_id: saccoId,
    name: name.trim(),
    body: body.trim(),
    description: description?.trim() || null,
    tokens: tokens ?? null,
    version: 1,
    is_active: false,
  };

  const { data, error } = await (supabase as any)
    .from("sms_templates")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    logError("admin_template_create_failed", { saccoId, error });
    return { status: "error", message: error.message ?? "Failed to create template" };
  }
  await revalidatePath("/admin");
  logInfo("admin_template_create_success", {
    saccoId,
    templateId: (data as { id?: string } | null)?.id,
  });
  return { status: "success", message: "Template created", template: data };
}

async function setSmsTemplateActiveInternal({
  templateId,
  isActive,
}: {
  templateId: string;
  isActive: boolean;
}): Promise<AdminActionResult> {
  const guard = await guardAdminAction<AdminActionResult>(
    {
      action: "admin_template_toggle",
      reason: "Only system administrators can update templates.",
      logEvent: "admin_template_toggle_denied",
      metadata: { templateId, isActive },
    },
    (error) => ({ status: "error", message: error.message })
  );

  if (guard.denied) {
    return guard.result;
  }
  const { supabase } = guard.context;

  const { error } = await (supabase as any)
    .from("sms_templates")
    .update({ is_active: isActive })
    .eq("id", templateId);
  if (error) {
    logError("admin_template_toggle_failed", { templateId, error, isActive });
    return { status: "error", message: error.message ?? "Failed to update template" };
  }
  await revalidatePath("/admin");
  logInfo("admin_template_toggle_success", { templateId, isActive });
  return { status: "success", message: isActive ? "Template activated" : "Template deactivated" };
}

async function deleteSmsTemplateInternal({
  templateId,
}: {
  templateId: string;
}): Promise<AdminActionResult> {
  const guard = await guardAdminAction<AdminActionResult>(
    {
      action: "admin_template_delete",
      reason: "Only system administrators can delete templates.",
      logEvent: "admin_template_delete_denied",
      metadata: { templateId },
      clientFactory: () => supabaseSrv(),
    },
    (error) => ({ status: "error", message: error.message })
  );
  if (guard.denied) {
    return guard.result;
  }
  const { supabase } = guard.context;
  const { error } = await supabase.from("sms_templates").delete().eq("id", templateId);
  if (error) {
    logError("admin_template_delete_failed", { templateId, error });
    return { status: "error", message: error.message ?? "Failed to delete template" };
  }
  await revalidatePath("/admin");
  logInfo("admin_template_delete_success", { templateId });
  return { status: "success", message: "Template deleted" };
}

async function ensureDistrictOrganization(
  supabase: SupabaseClient<Database>,
  districtNameRaw: string | null | undefined
): Promise<{ ok: true; orgId: string } | { ok: false; message: string }> {
  const districtName = (districtNameRaw ?? "").replace(/\s+/g, " ").trim();
  if (!districtName) {
    return { ok: false, message: "District name is required" };
  }

  const appSchema = (supabase as any).schema("app");
  const lookup = await appSchema
    .from("organizations")
    .select("id")
    .eq("type", "DISTRICT")
    .ilike("name", districtName)
    .maybeSingle();

  if (lookup.error) {
    return { ok: false, message: lookup.error.message ?? "Failed to look up district" };
  }
  if (lookup.data) {
    return { ok: true, orgId: (lookup.data as { id: string }).id };
  }

  const districtCode = districtName.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const insert = await appSchema
    .from("organizations")
    .insert({ name: districtName, type: "DISTRICT", district_code: districtCode })
    .select("id")
    .single();

  if (insert.error) {
    const retry = await appSchema
      .from("organizations")
      .select("id")
      .eq("type", "DISTRICT")
      .ilike("name", districtName)
      .maybeSingle();
    if (retry.data) {
      return { ok: true, orgId: (retry.data as { id: string }).id };
    }
    return { ok: false, message: insert.error.message ?? "Failed to create district organization" };
  }

  return { ok: true, orgId: (insert.data as { id: string }).id };
}

async function upsertSaccoInternal({
  mode,
  sacco,
}: {
  mode: "create" | "update";
  sacco:
    | Database["app"]["Tables"]["saccos"]["Insert"]
    | (Database["app"]["Tables"]["saccos"]["Update"] & { id: string });
}): Promise<AdminActionResult & { sacco?: Database["app"]["Tables"]["saccos"]["Row"] }> {
  const guard = await guardAdminAction<
    AdminActionResult & { sacco?: Database["app"]["Tables"]["saccos"]["Row"] }
  >(
    {
      action: "admin_sacco_upsert",
      reason: "Only system administrators can modify SACCO registry.",
      logEvent: "admin_sacco_upsert_denied",
      metadata: { mode },
      clientFactory: () => supabaseSrv(),
    },
    (error) => ({ status: "error", message: error.message })
  );
  if (guard.denied) {
    return guard.result;
  }
  const { supabase } = guard.context;
  // Normalize payload so we can inject a district org ID if the UI did not provide one
  const payload = {
    ...sacco,
  } as Database["app"]["Tables"]["saccos"]["Insert"] &
    Database["app"]["Tables"]["saccos"]["Update"] & { id?: string };

  const payloadId = (payload as { id?: string }).id ?? null;
  if (mode === "update" && !payloadId) {
    return { status: "error", message: "SACCO id is required for updates" };
  }

  const currentDistrictOrgId =
    (payload as { district_org_id?: string | null }).district_org_id ?? null;
  const districtName = (payload as { district?: string | null }).district ?? null;
  let ensuredOrgId = currentDistrictOrgId;
  if (!ensuredOrgId) {
    const ensured = await ensureDistrictOrganization(supabase, districtName);
    if (!ensured.ok) {
      return { status: "error", message: ensured.message };
    }
    ensuredOrgId = ensured.orgId;
    (payload as { district_org_id?: string | null }).district_org_id = ensuredOrgId;
  }

  let result: Database["app"]["Tables"]["saccos"]["Row"] | null = null;

  const appSchema = (supabase as any).schema("app").from("saccos");

  if (mode === "create") {
    const { data, error } = await appSchema
      .insert(payload as Database["app"]["Tables"]["saccos"]["Insert"])
      .select("*")
      .single();
    if (error) {
      logError("admin_sacco_create_failed", { error });
      return { status: "error", message: error.message ?? "Failed to create SACCO" };
    }
    result = data as Database["app"]["Tables"]["saccos"]["Row"];
  } else {
    const { data, error } = await appSchema
      .update(payload as Database["app"]["Tables"]["saccos"]["Update"])
      .eq("id", payloadId)
      .select("*")
      .single();
    if (error) {
      logError("admin_sacco_update_failed", { error, saccoId: payloadId });
      return { status: "error", message: error.message ?? "Failed to update SACCO" };
    }
    result = data as Database["app"]["Tables"]["saccos"]["Row"];
  }

  const saccoId = result?.id ?? null;
  await revalidatePath("/admin");
  await revalidateTag(CACHE_TAGS.ikiminaDirectory);
  if (saccoId) {
    await revalidateTag(CACHE_TAGS.sacco(saccoId));
  }
  await revalidateTag(CACHE_TAGS.dashboardSummary);

  logInfo("admin_sacco_upsert_success", { mode, saccoId });
  return { status: "success", sacco: result ?? undefined };
}

async function removeSaccoInternal({ id }: { id: string }): Promise<AdminActionResult> {
  const guard = await guardAdminAction<AdminActionResult>(
    {
      action: "admin_sacco_delete",
      reason: "Only system administrators can delete SACCOs.",
      logEvent: "admin_sacco_delete_denied",
      metadata: { saccoId: id },
      clientFactory: () => supabaseSrv(),
    },
    (error) => ({ status: "error", message: error.message })
  );
  if (guard.denied) {
    return guard.result;
  }
  const { supabase } = guard.context;
  const { error } = await supabase.schema("app").from("saccos").delete().eq("id", id);
  if (error) {
    logError("admin_sacco_delete_failed", { saccoId: id, error });
    return { status: "error", message: error.message ?? "Failed to delete SACCO" };
  }
  await revalidatePath("/admin");
  await revalidateTag(CACHE_TAGS.ikiminaDirectory);
  await revalidateTag(CACHE_TAGS.sacco(id));
  await revalidateTag(CACHE_TAGS.dashboardSummary);
  logInfo("admin_sacco_delete_success", { saccoId: id });
  return { status: "success", message: "SACCO deleted" };
}

export const queueNotification = instrumentServerAction(
  "admin.queueNotification",
  queueNotificationInternal
);
export const createSmsTemplate = instrumentServerAction(
  "admin.createSmsTemplate",
  createSmsTemplateInternal
);
export const setSmsTemplateActive = instrumentServerAction(
  "admin.setSmsTemplateActive",
  setSmsTemplateActiveInternal
);
async function updateTenantSettingsInternal({
  saccoId,
  settings,
}: {
  saccoId: string;
  settings: {
    rules: string;
    feePolicy: string;
    kycThresholds: { enhanced: number; freeze: number };
    integrations: { webhook: boolean; edgeReconciliation: boolean; notifications: boolean };
  };
}): Promise<AdminActionResult & { metadata?: Record<string, unknown> }> {
  const guard = await guardAdminAction<AdminActionResult & { metadata?: Record<string, unknown> }>(
    {
      action: "admin_settings_update",
      reason: "Only system administrators can update tenant settings.",
      logEvent: "admin_settings_update_denied",
      metadata: { saccoId },
    },
    (error) => ({ status: "error", message: error.message })
  );

  if (guard.denied) {
    return guard.result;
  }

  const { supabase, user } = guard.context;

  const { data: row, error: selectError } = await supabase
    .schema("app")
    .from("saccos")
    .select("id, metadata")
    .eq("id", saccoId)
    .maybeSingle();

  if (selectError) {
    logError("admin_settings_load_failed", { saccoId, error: selectError });
    return { status: "error", message: selectError.message ?? "Failed to load existing settings" };
  }

  const previousMetadata = (row?.metadata as Record<string, unknown> | null) ?? {};
  const nextMetadata = {
    ...previousMetadata,
    admin_settings: {
      ...(previousMetadata.admin_settings as Record<string, unknown> | undefined),
      rules: settings.rules,
      feePolicy: settings.feePolicy,
      kycThresholds: settings.kycThresholds,
      integrations: settings.integrations,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
  } satisfies Record<string, unknown>;

  const { data: updateResult, error: updateError } = await (supabase as any)
    .schema("app")
    .from("saccos")
    .update({ metadata: nextMetadata })
    .eq("id", saccoId)
    .select("metadata")
    .single();

  if (updateError) {
    logError("admin_settings_update_failed", { saccoId, error: updateError });
    return { status: "error", message: updateError.message ?? "Failed to update tenant settings" };
  }

  await logAudit({
    action: "TENANT_SETTINGS_UPDATED",
    entity: "SACCO",
    entityId: saccoId,
    diff: {
      rules: settings.rules,
      feePolicy: settings.feePolicy,
      kycThresholds: settings.kycThresholds,
      integrations: settings.integrations,
    },
  });

  await revalidatePath("/admin/settings");
  await revalidateTag(CACHE_TAGS.sacco(saccoId));

  logInfo("admin_settings_update_success", { saccoId });
  return {
    status: "success",
    message: "Settings updated",
    metadata: updateResult?.metadata ?? nextMetadata,
  };
}

async function resolveOcrReviewInternal({
  memberUserId,
  decision,
  note,
}: {
  memberUserId: string;
  decision: "accept" | "rescan";
  note?: string;
}): Promise<AdminActionResult> {
  const guard = await guardAdminAction<AdminActionResult>(
    {
      action: "admin_ocr_review",
      reason: "Insufficient permissions for OCR review.",
      logEvent: "admin_ocr_review_denied",
      metadata: { memberUserId, decision },
      allowedRoles: ["SYSTEM_ADMIN", "SACCO_MANAGER"],
    },
    (error) => ({ status: "error", message: error.message })
  );

  if (guard.denied) {
    return guard.result;
  }

  const { supabase, user } = guard.context;

  const legacyClient = supabase as any;
  const { data: profileRow, error: loadError } = await legacyClient
    .from("members_app_profiles")
    .select("ocr_json, is_verified")
    .eq("user_id", memberUserId)
    .maybeSingle();

  if (loadError) {
    logError("admin_ocr_review_load_failed", { memberUserId, error: loadError });
    return { status: "error", message: loadError.message ?? "Failed to load OCR payload" };
  }

  const existingOcr = (profileRow?.ocr_json as Record<string, unknown> | null) ?? {};
  const reviewedAt = new Date().toISOString();
  const nextOcr = {
    ...existingOcr,
    status: decision === "accept" ? "accepted" : "needs_rescan",
    reviewed_at: reviewedAt,
    reviewer: user.id,
    note: note ?? null,
  } satisfies Record<string, unknown>;

  const updatePayload = {
    is_verified: decision === "accept",
    ocr_json: nextOcr,
  };

  const { error: updateError } = await legacyClient
    .from("members_app_profiles")
    .update(updatePayload)
    .eq("user_id", memberUserId);

  if (updateError) {
    logError("admin_ocr_review_update_failed", { memberUserId, decision, error: updateError });
    return { status: "error", message: updateError.message ?? "Failed to update OCR review" };
  }

  await logAudit({
    action: decision === "accept" ? "OCR_ACCEPTED" : "OCR_RESCAN_REQUESTED",
    entity: "MEMBER_PROFILE",
    entityId: memberUserId,
    diff: { decision, note: note ?? null },
  });

  await revalidatePath("/admin/ocr");
  logInfo("admin_ocr_review_success", { memberUserId, decision });
  return {
    status: "success",
    message: decision === "accept" ? "Document approved" : "Rescan requested",
  };
}

export const deleteSmsTemplate = instrumentServerAction(
  "admin.deleteSmsTemplate",
  deleteSmsTemplateInternal
);
export const upsertSacco = instrumentServerAction("admin.upsertSacco", upsertSaccoInternal);
export const removeSacco = instrumentServerAction("admin.removeSacco", removeSaccoInternal);
export const updateTenantSettings = instrumentServerAction(
  "admin.updateTenantSettings",
  updateTenantSettingsInternal
);
export const resolveOcrReview = instrumentServerAction(
  "admin.resolveOcrReview",
  resolveOcrReviewInternal
);

// ---------- Financial institution management ----------

type FinancialInstitutionPayload = {
  id?: string;
  name: string;
  kind: Database["app"]["Enums"]["financial_institution_kind"];
  district: string;
  saccoId?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function upsertFinancialInstitutionInternal(
  payload: FinancialInstitutionPayload
): Promise<
  AdminActionResult & { record?: Database["app"]["Tables"]["financial_institutions"]["Row"] }
> {
  const { profile, user } = await requireUserAndProfile();
  updateLogContext({ userId: user.id, saccoId: profile.sacco_id ?? null });

  if (profile.role !== "SYSTEM_ADMIN") {
    logWarn("admin_financial_institution_denied", { actorRole: profile.role });
    return {
      status: "error",
      message: "Only system administrators can manage financial institutions.",
    };
  }

  const supabase = supabaseSrv();
  const table = supabase.schema("app").from("financial_institutions");
  const basePayload: Database["app"]["Tables"]["financial_institutions"]["Insert"] = {
    name: payload.name.trim(),
    kind: payload.kind,
    district: payload.district.trim().toUpperCase(),
    sacco_id: payload.saccoId ?? null,
    metadata: (payload.metadata ??
      {}) as Database["app"]["Tables"]["financial_institutions"]["Row"]["metadata"],
  };

  let result;
  if (payload.id) {
    result = await (table as any)
      .update(basePayload)
      .eq("id", payload.id)
      .select("*")
      .maybeSingle();
  } else {
    result = await (table as any).insert(basePayload).select("*").single();
  }

  if (result.error) {
    logError("admin_financial_institution_upsert_failed", { error: result.error, payload });
    return { status: "error", message: result.error.message ?? "Failed to save institution" };
  }

  const institutionId = (result.data as { id?: string } | null)?.id ?? "UNKNOWN";

  await logAudit({
    action: payload.id ? "FINANCIAL_INSTITUTION_UPDATED" : "FINANCIAL_INSTITUTION_CREATED",
    entity: "financial_institutions",
    entityId: institutionId,
    diff: {
      name: payload.name,
      kind: payload.kind,
      district: payload.district,
      saccoId: payload.saccoId ?? null,
    },
  });

  await revalidatePath("/admin");
  return {
    status: "success",
    message: payload.id ? "Institution updated" : "Institution created",
    record: result.data ?? undefined,
  };
}

async function deleteFinancialInstitutionInternal({
  id,
}: {
  id: string;
}): Promise<AdminActionResult> {
  const { profile, user } = await requireUserAndProfile();
  updateLogContext({ userId: user.id, saccoId: profile.sacco_id ?? null });

  if (profile.role !== "SYSTEM_ADMIN") {
    logWarn("admin_financial_institution_delete_denied", { actorRole: profile.role });
    return {
      status: "error",
      message: "Only system administrators can manage financial institutions.",
    };
  }

  const supabase = supabaseSrv();
  const { error } = await supabase
    .schema("app")
    .from("financial_institutions")
    .delete()
    .eq("id", id);

  if (error) {
    logError("admin_financial_institution_delete_failed", { error, id });
    return { status: "error", message: error.message ?? "Failed to delete institution" };
  }

  await logAudit({
    action: "FINANCIAL_INSTITUTION_DELETED",
    entity: "financial_institutions",
    entityId: id,
    diff: null,
  });

  await revalidatePath("/admin");
  return { status: "success", message: "Institution removed" };
}

export const upsertFinancialInstitution = instrumentServerAction(
  "admin.upsertFinancialInstitution",
  upsertFinancialInstitutionInternal
);
export const deleteFinancialInstitution = instrumentServerAction(
  "admin.deleteFinancialInstitution",
  deleteFinancialInstitutionInternal
);

// ---------- MoMo code management ----------

type MomoCodePayload = {
  id?: string;
  provider: string;
  district: string;
  code: string;
  accountName?: string | null;
  description?: string | null;
};

async function upsertMomoCodeInternal(
  payload: MomoCodePayload
): Promise<AdminActionResult & { record?: Database["app"]["Tables"]["momo_codes"]["Row"] }> {
  const { profile, user } = await requireUserAndProfile();
  updateLogContext({ userId: user.id, saccoId: profile.sacco_id ?? null });

  if (profile.role !== "SYSTEM_ADMIN") {
    logWarn("admin_momo_code_denied", { actorRole: profile.role });
    return { status: "error", message: "Only system administrators can manage MoMo codes." };
  }

  const supabase = supabaseSrv();
  const table = supabase.schema("app").from("momo_codes");
  const basePayload: Database["app"]["Tables"]["momo_codes"]["Insert"] = {
    provider: (payload.provider ?? "").trim().toUpperCase(),
    district: (payload.district ?? "").trim().toUpperCase(),
    code: (payload.code ?? "").trim(),
    account_name: payload.accountName?.trim() || null,
    description: payload.description?.trim() || null,
  };

  let result;
  if (payload.id) {
    result = await (table as any)
      .update(basePayload)
      .eq("id", payload.id)
      .select("*")
      .maybeSingle();
  } else {
    result = await (table as any).insert(basePayload).select("*").single();
  }

  if (result.error) {
    logError("admin_momo_code_upsert_failed", { error: result.error, payload });
    return { status: "error", message: result.error.message ?? "Failed to save MoMo code" };
  }

  const momoCodeId = (result.data as { id?: string } | null)?.id ?? "UNKNOWN";

  await logAudit({
    action: payload.id ? "MOMO_CODE_UPDATED" : "MOMO_CODE_CREATED",
    entity: "momo_codes",
    entityId: momoCodeId,
    diff: {
      provider: payload.provider,
      district: payload.district,
      code: payload.code,
      accountName: payload.accountName ?? null,
      description: payload.description ?? null,
    },
  });

  await revalidatePath("/admin");
  return {
    status: "success",
    message: payload.id ? "MoMo code updated" : "MoMo code created",
    record: result.data ?? undefined,
  };
}

async function deleteMomoCodeInternal({ id }: { id: string }): Promise<AdminActionResult> {
  const { profile, user } = await requireUserAndProfile();
  updateLogContext({ userId: user.id, saccoId: profile.sacco_id ?? null });

  if (profile.role !== "SYSTEM_ADMIN") {
    logWarn("admin_momo_code_delete_denied", { actorRole: profile.role });
    return { status: "error", message: "Only system administrators can manage MoMo codes." };
  }

  const supabase = supabaseSrv();
  const { error } = await supabase.schema("app").from("momo_codes").delete().eq("id", id);

  if (error) {
    logError("admin_momo_code_delete_failed", { error, id });
    return { status: "error", message: error.message ?? "Failed to delete MoMo code" };
  }

  await logAudit({
    action: "MOMO_CODE_DELETED",
    entity: "momo_codes",
    entityId: id,
    diff: null,
  });

  await revalidatePath("/admin");
  return { status: "success", message: "MoMo code removed" };
}

export const upsertMomoCode = instrumentServerAction(
  "admin.upsertMomoCode",
  upsertMomoCodeInternal
);
export const deleteMomoCode = instrumentServerAction(
  "admin.deleteMomoCode",
  deleteMomoCodeInternal
);
