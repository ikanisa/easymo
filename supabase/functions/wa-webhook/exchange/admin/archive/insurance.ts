import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { recordAdminAudit } from "./audit.ts";
import { logStructuredEvent } from "../../observe/log.ts";

const LIST_LIMIT = 9;

function toLeadRow(lead: any) {
  return {
    id: lead.id,
    status: lead.status,
    file_path: lead.file_path,
    created_at: lead.created_at,
    assigned_admin: lead.assigned_admin,
  };
}

export async function handleAdminInsurance(
  req: FlowExchangeRequest,
  ctx: { waId: string; isInsurance: boolean },
): Promise<FlowExchangeResponse> {
  if (!ctx.isInsurance) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Insurance access restricted." }],
    };
  }

  switch (req.action_id) {
    case "a_admin_insurance_refresh":
    case "a_admin_open_insurance":
      return await listLeads(req);
    case "a_admin_lead_mark_reviewed":
      return await markReviewed(req, ctx.waId);
    case "a_admin_lead_assign_owner":
      return await assignOwner(req, ctx.waId);
    case "a_admin_lead_request_reupload":
      return await requestReupload(req, ctx.waId);
    case "a_admin_lead_issue_voucher":
      return await launchVoucherIssue(req);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown insurance action ${req.action_id}`,
        }],
      };
  }
}

async function listLeads(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const { data, error } = await supabase
    .from("insurance_leads")
    .select("id, status, file_path, created_at, assigned_admin")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) {
    await logStructuredEvent("ADMIN_INSURANCE_LIST_FAIL", {
      error: error.message,
    });
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to load insurance leads." }],
    };
  }
  return {
    next_screen_id: "s_leads_list",
    data: {
      leads: (data ?? []).map(toLeadRow),
    },
  };
}

async function markReviewed(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const leadId = typeof req.fields?.lead_id === "string"
    ? req.fields.lead_id
    : undefined;
  if (!leadId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing lead id." }],
    };
  }
  const { error } = await supabase
    .from("insurance_leads")
    .update({ status: "reviewed" })
    .eq("id", leadId);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to update lead." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_lead_mark_reviewed",
    targetId: leadId,
  });
  return {
    next_screen_id: "s_lead_detail",
    messages: [{ level: "info", text: "Lead marked reviewed." }],
    data: { lead_id: leadId, status: "reviewed" },
  };
}

async function assignOwner(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const leadId = typeof req.fields?.lead_id === "string"
    ? req.fields.lead_id
    : undefined;
  const ownerWa = typeof req.fields?.owner_wa === "string"
    ? req.fields.owner_wa
    : undefined;
  if (!leadId || !ownerWa) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing lead or owner." }],
    };
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("whatsapp_e164", ownerWa)
    .maybeSingle();
  if (profileError || !profile) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Owner not found." }],
    };
  }
  const { error } = await supabase
    .from("insurance_leads")
    .update({ assigned_admin: profile.user_id })
    .eq("id", leadId);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to assign owner." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_lead_assign",
    targetId: leadId,
    after: { assigned_admin: profile.user_id },
  });
  return {
    next_screen_id: "s_lead_detail",
    messages: [{ level: "info", text: "Lead assigned." }],
    data: { lead_id: leadId, assigned_admin: ownerWa },
  };
}

async function requestReupload(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const leadId = typeof req.fields?.lead_id === "string"
    ? req.fields.lead_id
    : undefined;
  if (!leadId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing lead id." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_lead_request_reupload",
    targetId: leadId,
  });
  await logStructuredEvent("ADMIN_INSURANCE_REUPLOAD", { lead_id: leadId });
  return {
    next_screen_id: "s_lead_detail",
    messages: [{ level: "info", text: "Re-upload request noted." }],
  };
}

async function launchVoucherIssue(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const leadId = typeof req.fields?.lead_id === "string"
    ? req.fields.lead_id
    : undefined;
  if (!leadId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing lead id." }],
    };
  }
  const { data: lead, error } = await supabase
    .from("insurance_leads")
    .select("user_id, policy_number, extracted")
    .eq("id", leadId)
    .maybeSingle();
  if (error || !lead) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Lead not found." }],
    };
  }
  const policyNumber: string | null = lead.policy_number ??
    (typeof lead.extracted?.policy_number === "string"
      ? lead.extracted.policy_number
      : null);
  const plate: string | null = typeof lead.extracted?.plate === "string"
    ? lead.extracted.plate
    : null;
  let waId: string | null = null;
  if (lead.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_e164")
      .eq("user_id", lead.user_id)
      .maybeSingle();
    waId = profile?.whatsapp_e164 ?? null;
  }
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "info", text: "Opening voucher flow." }],
    data: {
      launch_flow_id: "flow.admin.vouchers.v1",
      prefill: {
        whatsapp_e164: waId,
        policy_number: policyNumber,
        plate,
      },
    },
  };
}
