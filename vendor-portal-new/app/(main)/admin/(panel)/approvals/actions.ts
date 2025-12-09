"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { logAudit } from "@/lib/audit";
import type { Database } from "@/lib/supabase/types";
import { guardAdminAction } from "@/lib/admin/guard";
import { instrumentServerAction } from "@/lib/observability/server-action";
import { logError, logWarn } from "@/lib/observability/logger";

export type ApprovalActionResult = {
  status: "success" | "error";
  message?: string;
};

const SACCO_SCOPED_ROLES: Array<Database["public"]["Enums"]["app_role"]> = [
  "SYSTEM_ADMIN",
  "SACCO_MANAGER",
  "SACCO_STAFF",
];

async function decideJoinRequestInternal({
  requestId,
  decision,
  reason,
}: {
  requestId: string;
  decision: "approved" | "rejected";
  reason?: string;
}): Promise<ApprovalActionResult> {
  const guard = await guardAdminAction<ApprovalActionResult>(
    {
      action: "admin_join_request_decide",
      reason: "You are not allowed to manage this join request.",
      logEvent: "admin_join_request_decide_denied",
      metadata: { requestId, decision },
      allowedRoles: SACCO_SCOPED_ROLES,
    },
    (error) => ({ status: "error", message: error.message })
  );

  if (guard.denied) {
    return guard.result;
  }

  const { supabase, profile, user } = guard.context;

  const { data: request, error } = await supabase
    .from("join_requests")
    .select("id, status, sacco_id, group_id, user_id, note")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    logError("admin.joinRequest.fetchFailed", { requestId, error });
    return { status: "error", message: error.message ?? "Failed to load join request" };
  }

  if (!request) {
    return { status: "error", message: "Join request not found" };
  }

  if (profile.role !== "SYSTEM_ADMIN" && profile.sacco_id !== request.sacco_id) {
    logWarn("admin.joinRequest.unauthorized", {
      requestId,
      actor: profile.id,
      saccoId: profile.sacco_id,
    });
    return { status: "error", message: "You are not allowed to manage this join request." };
  }

  const nextStatus = decision === "approved" ? "approved" : "rejected";
  const { error: updateError } = await supabase
    .from("join_requests")
    .update({
      status: nextStatus,
      decided_at: new Date().toISOString(),
      decided_by: user.id,
      note: reason ?? request.note ?? null,
    })
    .eq("id", requestId);

  if (updateError) {
    logError("admin.joinRequest.updateFailed", { requestId, decision, updateError });
    return { status: "error", message: updateError.message ?? "Failed to update join request" };
  }

  await logAudit({
    action: decision === "approved" ? "join_request_approved" : "join_request_rejected",
    entity: "join_request",
    entityId: requestId,
    diff: { decision, reason: reason ?? null },
  });

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/overview");

  return { status: "success" };
}

async function resendInviteInternal({
  inviteId,
}: {
  inviteId: string;
}): Promise<ApprovalActionResult> {
  const guard = await guardAdminAction<ApprovalActionResult>(
    {
      action: "admin_group_invite_resend",
      reason: "You are not allowed to resend this invite.",
      logEvent: "admin_group_invite_resend_denied",
      metadata: { inviteId },
      allowedRoles: SACCO_SCOPED_ROLES,
    },
    (error) => ({ status: "error", message: error.message })
  );

  if (guard.denied) {
    return guard.result;
  }

  const { supabase, profile } = guard.context;

  const { data: invite, error } = await supabase
    .from("group_invites")
    .select("id, group_id, status, group:ibimina(sacco_id)")
    .eq("id", inviteId)
    .maybeSingle();

  if (error) {
    logError("admin.invite.fetchFailed", { inviteId, error });
    return { status: "error", message: error.message ?? "Failed to load invite" };
  }

  if (!invite) {
    return { status: "error", message: "Invite not found" };
  }

  const saccoId = invite.group?.sacco_id ?? null;
  if (profile.role !== "SYSTEM_ADMIN" && profile.sacco_id !== saccoId) {
    logWarn("admin.invite.unauthorized", { inviteId, actor: profile.id, saccoId });
    return { status: "error", message: "You are not allowed to resend this invite." };
  }

  const { error: updateError } = await (supabase as any)
    .from("group_invites")
    .update({
      status: "sent",
      created_at: new Date().toISOString(),
    })
    .eq("id", inviteId);

  if (updateError) {
    logError("admin.invite.resendFailed", { inviteId, updateError });
    return { status: "error", message: updateError.message ?? "Failed to resend invite" };
  }

  await logAudit({
    action: "group_invite_resent",
    entity: "group_invite",
    entityId: inviteId,
    diff: null,
  });

  revalidatePath("/admin/approvals");
  return { status: "success" };
}

async function revokeInviteInternal({
  inviteId,
}: {
  inviteId: string;
}): Promise<ApprovalActionResult> {
  const guard = await guardAdminAction<ApprovalActionResult>(
    {
      action: "admin_group_invite_revoke",
      reason: "You are not allowed to revoke this invite.",
      logEvent: "admin_group_invite_revoke_denied",
      metadata: { inviteId },
      allowedRoles: SACCO_SCOPED_ROLES,
    },
    (error) => ({ status: "error", message: error.message })
  );

  if (guard.denied) {
    return guard.result;
  }

  const { supabase, profile } = guard.context;

  const { data: invite, error } = await supabase
    .from("group_invites")
    .select("id, group_id, status, group:ibimina(sacco_id)")
    .eq("id", inviteId)
    .maybeSingle();

  if (error) {
    logError("admin.invite.fetchFailed", { inviteId, error });
    return { status: "error", message: error.message ?? "Failed to load invite" };
  }

  if (!invite) {
    return { status: "error", message: "Invite not found" };
  }

  const saccoId = invite.group?.sacco_id ?? null;
  if (profile.role !== "SYSTEM_ADMIN" && profile.sacco_id !== saccoId) {
    logWarn("admin.invite.unauthorized", { inviteId, actor: profile.id, saccoId });
    return { status: "error", message: "You are not allowed to revoke this invite." };
  }

  const { error: updateError } = await (supabase as any)
    .from("group_invites")
    .update({ status: "expired" })
    .eq("id", inviteId);

  if (updateError) {
    logError("admin.invite.revokeFailed", { inviteId, updateError });
    return { status: "error", message: updateError.message ?? "Failed to revoke invite" };
  }

  await logAudit({
    action: "group_invite_revoked",
    entity: "group_invite",
    entityId: inviteId,
    diff: null,
  });

  revalidatePath("/admin/approvals");
  return { status: "success" };
}

async function sendInviteInternal({
  groupId,
  msisdn,
}: {
  groupId: string;
  msisdn: string;
}): Promise<ApprovalActionResult> {
  const guard = await guardAdminAction<ApprovalActionResult>(
    {
      action: "admin_group_invite_send",
      reason: "You are not allowed to invite to this group.",
      logEvent: "admin_group_invite_send_denied",
      metadata: { groupId },
      allowedRoles: SACCO_SCOPED_ROLES,
    },
    (error) => ({ status: "error", message: error.message })
  );

  if (guard.denied) {
    return guard.result;
  }

  const { supabase, profile } = guard.context;

  const { data: group, error } = await supabase
    .schema("app")
    .from("ikimina")
    .select("id, sacco_id")
    .eq("id", groupId)
    .maybeSingle();

  if (error) {
    logError("admin.invite.groupLookupFailed", { groupId, error });
    return { status: "error", message: error.message ?? "Failed to load group" };
  }

  if (!group) {
    return { status: "error", message: "Group not found" };
  }

  if (profile.role !== "SYSTEM_ADMIN" && profile.sacco_id !== group.sacco_id) {
    logWarn("admin.invite.createUnauthorized", {
      groupId,
      actor: profile.id,
      saccoId: group.sacco_id,
    });
    return { status: "error", message: "You are not allowed to invite to this group." };
  }

  const normalizedMsisdn = msisdn.trim();
  if (!normalizedMsisdn) {
    return { status: "error", message: "Recipient MSISDN is required" };
  }

  const token = randomBytes(24).toString("hex");

  const { error: insertError, data } = await (supabase as any)
    .from("group_invites")
    .insert({
      group_id: groupId,
      invitee_msisdn: normalizedMsisdn,
      status: "sent",
      token,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    logError("admin.invite.createFailed", { groupId, insertError });
    return { status: "error", message: insertError.message ?? "Failed to create invite" };
  }

  await logAudit({
    action: "group_invite_created",
    entity: "group_invite",
    entityId: data?.id ?? "unknown",
    diff: { groupId, msisdn: normalizedMsisdn },
  });

  revalidatePath("/admin/approvals");
  return { status: "success" };
}

export const decideJoinRequest = instrumentServerAction(
  "admin.approvals.decideJoinRequest",
  decideJoinRequestInternal
);
export const resendInvite = instrumentServerAction(
  "admin.approvals.resendInvite",
  resendInviteInternal
);
export const revokeInvite = instrumentServerAction(
  "admin.approvals.revokeInvite",
  revokeInviteInternal
);
export const sendInvite = instrumentServerAction("admin.approvals.sendInvite", sendInviteInternal);
