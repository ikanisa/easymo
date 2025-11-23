import type { RouterContext } from "../../types.ts";
import type { ChatState } from "../../state/store.ts";
import { sendText } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { ADMIN_ROW_IDS } from "./hub.ts";
import { ADMIN_STATE, ensureAdmin, setAdminState } from "./state.ts";
import {
  sendAdminActionButton,
  sendAdminList,
  sendAdminViewButton,
} from "./ui.ts";

const MAX_LEAD_ROWS = 9;
const JSON_EXPORT_MAX_LENGTH = 3000;

// Messages for insurance admin actions
const MESSAGES = {
  REUPLOAD_REQUEST:
    "Hello! We need you to re-upload your insurance documents. Please send clearer photos of your insurance certificate and carte jaune. Thank you!",
};

type InsuranceExtracted = {
  registration_plate?: string;
  plate?: string;
  insurer?: string;
  insurance_company?: string;
  [key: string]: unknown;
};

type AdminLead = {
  id: string;
  title: string;
  insurer?: string | null;
  plate?: string | null;
};

export async function showAdminInsuranceEntry(
  ctx: RouterContext,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.INSURANCE_ENTRY, {
    back: ADMIN_STATE.HUB_LIST,
  });
  await sendAdminViewButton(ctx, {
    body: "Insurance leads — review uploads and take action.",
    id: IDS.ADMIN_INSURANCE_VIEW,
    emoji: "🛡️",
  });
}

export async function showAdminInsuranceList(
  ctx: RouterContext,
  leads: AdminLead[] = [],
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  const trimmed = leads.slice(0, MAX_LEAD_ROWS);
  const rows = trimmed.map((lead) => ({
    id: `${ADMIN_ROW_IDS.INSURANCE_LEAD_PREFIX}${lead.id}`,
    title: leadTitle(lead).slice(0, 24),
  }));
  if (!rows.length) {
    rows.push({
      id: `${ADMIN_ROW_IDS.INSURANCE_LEAD_PREFIX}NONE`,
      title: "No leads awaiting",
    });
  }
  rows.push({ id: IDS.BACK_MENU, title: "← Back" });
  await setAdminState(ctx, ADMIN_STATE.INSURANCE_LIST, {
    back: ADMIN_STATE.INSURANCE_ENTRY,
    data: { leads: trimmed },
  });
  await sendAdminList(
    ctx,
    {
      title: "Insurance leads",
      body: "Pick a lead to manage.",
      sectionTitle: "Latest",
      rows,
    },
    { emoji: "🛡️" },
  );
}

export async function handleAdminInsuranceRow(
  ctx: RouterContext,
  id: string,
  state: ChatState,
): Promise<boolean> {
  if (id.startsWith(ADMIN_ROW_IDS.INSURANCE_LEAD_PREFIX)) {
    const leadId = id.slice(ADMIN_ROW_IDS.INSURANCE_LEAD_PREFIX.length);
    if (leadId === "NONE") {
      await sendText(ctx.from, "No insurance leads need action right now.");
      return true;
    }
    const lead = findLeadInState(state, leadId);
    await showInsuranceDetailEntry(
      ctx,
      leadId,
      leadTitle(lead ?? { id: leadId, title: "Lead" }),
    );
    return true;
  }
  switch (id) {
    case ADMIN_ROW_IDS.INSURANCE_DETAIL_DM:
      await showInsuranceConfirm(
        ctx,
        "DM the client with next steps?",
        IDS.ADMIN_INSURANCE_DM_SUBMIT,
        state,
      );
      return true;
    case ADMIN_ROW_IDS.INSURANCE_DETAIL_REVIEW:
      await showInsuranceConfirm(
        ctx,
        "Mark this lead as reviewed?",
        IDS.ADMIN_INSURANCE_REVIEW_SUBMIT,
        state,
      );
      return true;
    case ADMIN_ROW_IDS.INSURANCE_DETAIL_MORE:
      await showInsuranceMoreEntry(ctx, state);
      return true;
    case ADMIN_ROW_IDS.INSURANCE_MORE_REQUEST:
      await showInsuranceConfirm(
        ctx,
        "Request a re-upload from the client?",
        IDS.ADMIN_INSURANCE_REQUEST_SUBMIT,
        state,
      );
      return true;
    case ADMIN_ROW_IDS.INSURANCE_MORE_ASSIGN:
      await showInsuranceConfirm(
        ctx,
        "Assign a new owner for this lead?",
        IDS.ADMIN_INSURANCE_ASSIGN_SUBMIT,
        state,
      );
      return true;
    case ADMIN_ROW_IDS.INSURANCE_MORE_EXPORT:
      await showInsuranceConfirm(
        ctx,
        "Export this lead as JSON?",
        IDS.ADMIN_INSURANCE_EXPORT_SUBMIT,
        state,
      );
      return true;
    default:
      return false;
  }
}

export async function showInsuranceDetailEntry(
  ctx: RouterContext,
  leadId: string,
  title: string,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.INSURANCE_DETAIL, {
    back: ADMIN_STATE.INSURANCE_LIST,
    data: { leadId, title },
  });
  await sendAdminViewButton(ctx, {
    body: `${title.slice(0, 24)} — manage lead actions.`,
    id: IDS.ADMIN_INSURANCE_DETAIL_VIEW,
    emoji: "🛡️",
  });
}

export async function showInsuranceDetailMenu(
  ctx: RouterContext,
  state: ChatState,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  const title = typeof state.data?.title === "string"
    ? state.data.title.slice(0, 24)
    : "Lead";
  await setAdminState(ctx, ADMIN_STATE.INSURANCE_DETAIL_MENU, {
    back: ADMIN_STATE.INSURANCE_DETAIL,
    data: state.data ?? {},
  });
  await sendAdminList(
    ctx,
    {
      title,
      body: "Pick an action for this lead.",
      sectionTitle: "Lead actions",
      rows: [
        { id: ADMIN_ROW_IDS.INSURANCE_DETAIL_DM, title: "DM client" },
        { id: ADMIN_ROW_IDS.INSURANCE_DETAIL_REVIEW, title: "Mark reviewed" },
        { id: ADMIN_ROW_IDS.INSURANCE_DETAIL_MORE, title: "More…" },
        { id: IDS.BACK_MENU, title: "← Back" },
      ],
    },
    { emoji: "🛡️" },
  );
}

export async function showInsuranceMoreEntry(
  ctx: RouterContext,
  state: ChatState,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.INSURANCE_MORE, {
    back: ADMIN_STATE.INSURANCE_DETAIL_MENU,
    data: state.data ?? {},
  });
  await sendAdminViewButton(ctx, {
    body: "More lead actions.",
    id: IDS.ADMIN_INSURANCE_MORE_VIEW,
    emoji: "🗂️",
  });
}

export async function showInsuranceMoreMenu(
  ctx: RouterContext,
  state: ChatState,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.INSURANCE_MORE_LIST, {
    back: ADMIN_STATE.INSURANCE_MORE,
    data: state.data ?? {},
  });
  await sendAdminList(
    ctx,
    {
      title: "Lead — more",
      body: "Pick a follow-up action.",
      sectionTitle: "More",
      rows: [
        {
          id: ADMIN_ROW_IDS.INSURANCE_MORE_REQUEST,
          title: "Request re-upload",
        },
        { id: ADMIN_ROW_IDS.INSURANCE_MORE_ASSIGN, title: "Assign owner" },
        { id: ADMIN_ROW_IDS.INSURANCE_MORE_EXPORT, title: "Export JSON" },
        { id: IDS.BACK_MENU, title: "← Back" },
      ],
    },
    { emoji: "🗂️" },
  );
}

async function showInsuranceConfirm(
  ctx: RouterContext,
  body: string,
  buttonId: string,
  state: ChatState,
): Promise<void> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return;
  await setAdminState(ctx, ADMIN_STATE.INSURANCE_DETAIL_MENU, {
    back: ADMIN_STATE.INSURANCE_DETAIL_MENU,
    data: state.data ?? {},
  });
  await sendAdminActionButton(ctx, {
    body,
    id: buttonId,
    title: "Confirm",
    emoji: "✅",
  });
}

export async function hydrateInsuranceLeads(
  ctx: RouterContext,
): Promise<AdminLead[]> {
  try {
    const { data, error } = await ctx.supabase
      .from("insurance_leads")
      .select("id, extracted, status")
      .in("status", ["received", "pending", "in_review"])
      .order("created_at", { ascending: false })
      .limit(MAX_LEAD_ROWS);

    if (error) {
      console.error("Failed to fetch insurance leads:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((lead) => {
      const extracted = lead.extracted as InsuranceExtracted | null;
      const plate = extracted?.registration_plate || extracted?.plate || null;
      const insurer = extracted?.insurer || extracted?.insurance_company || null;
      
      return {
        id: lead.id,
        title: [plate, insurer].filter(Boolean).join(" • ") || "Untitled Lead",
        plate,
        insurer,
      };
    });
  } catch (err) {
    console.error("Error hydrating insurance leads:", err);
    return [];
  }
}

export async function handleInsuranceButton(
  ctx: RouterContext,
  id: string,
  state: ChatState,
): Promise<boolean> {
  switch (id) {
    case IDS.ADMIN_INSURANCE_VIEW:
      await showAdminInsuranceList(ctx, await hydrateInsuranceLeads(ctx));
      return true;
    case IDS.ADMIN_INSURANCE_DETAIL_VIEW:
      await showInsuranceDetailMenu(ctx, state);
      return true;
    case IDS.ADMIN_INSURANCE_MORE_VIEW:
      await showInsuranceMoreMenu(ctx, state);
      return true;
    case IDS.ADMIN_INSURANCE_DM_SUBMIT:
      await handleDMClient(ctx, state);
      return true;
    case IDS.ADMIN_INSURANCE_REVIEW_SUBMIT:
      await handleMarkReviewed(ctx, state);
      return true;
    case IDS.ADMIN_INSURANCE_REQUEST_SUBMIT:
      await handleRequestReupload(ctx, state);
      return true;
    case IDS.ADMIN_INSURANCE_ASSIGN_SUBMIT:
      await handleAssignOwner(ctx, state);
      return true;
    case IDS.ADMIN_INSURANCE_EXPORT_SUBMIT:
      await handleExportJSON(ctx, state);
      return true;
    default:
      return false;
  }
}

function leadTitle(lead: AdminLead): string {
  if (!lead) return "Lead";
  const base = lead.title ||
    [lead.plate, lead.insurer].filter(Boolean).join(" • ");
  return base || "Lead";
}

function findLeadInState(state: ChatState, leadId: string): AdminLead | null {
  const raw = state.data?.leads;
  if (!Array.isArray(raw)) return null;
  const match = raw.find((item) => item?.id === leadId);
  return match ?? null;
}

function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

async function handleMarkReviewed(
  ctx: RouterContext,
  state: ChatState,
): Promise<void> {
  const leadId = state.data?.leadId;
  if (!leadId) {
    await sendText(ctx.from, "❌ No lead selected.");
    return;
  }

  try {
    const { error } = await ctx.supabase
      .from("insurance_leads")
      .update({ status: "reviewed", updated_at: new Date().toISOString() })
      .eq("id", leadId);

    if (error) {
      await sendText(ctx.from, "❌ Failed to mark lead as reviewed.");
      console.error("Failed to mark lead as reviewed:", error);
      return;
    }

    await sendText(ctx.from, "✅ Lead marked as reviewed.");
  } catch (err) {
    await sendText(ctx.from, "❌ Error marking lead as reviewed.");
    console.error("Error marking lead as reviewed:", err);
  }
}

async function handleDMClient(
  ctx: RouterContext,
  state: ChatState,
): Promise<void> {
  const leadId = state.data?.leadId;
  if (!leadId) {
    await sendText(ctx.from, "❌ No lead selected.");
    return;
  }

  try {
    const { data, error } = await ctx.supabase
      .from("insurance_leads")
      .select("whatsapp, extracted")
      .eq("id", leadId)
      .single();

    if (error || !data) {
      await sendText(ctx.from, "❌ Failed to fetch lead details.");
      console.error("Failed to fetch lead details:", error);
      return;
    }

    const whatsapp = data.whatsapp;
    if (!whatsapp) {
      await sendText(ctx.from, "❌ No WhatsApp contact found for this lead.");
      return;
    }

    const waLink = `https://wa.me/${sanitizePhoneNumber(whatsapp)}`;
    await sendText(
      ctx.from,
      `📱 Client contact:\n\nWhatsApp: ${whatsapp}\n\nClick to message: ${waLink}`,
    );
  } catch (err) {
    await sendText(ctx.from, "❌ Error fetching client contact.");
    console.error("Error fetching client contact:", err);
  }
}

async function handleRequestReupload(
  ctx: RouterContext,
  state: ChatState,
): Promise<void> {
  const leadId = state.data?.leadId;
  if (!leadId) {
    await sendText(ctx.from, "❌ No lead selected.");
    return;
  }

  try {
    const { data, error } = await ctx.supabase
      .from("insurance_leads")
      .select("whatsapp")
      .eq("id", leadId)
      .single();

    if (error || !data?.whatsapp) {
      await sendText(ctx.from, "❌ Failed to fetch lead contact.");
      console.error("Failed to fetch lead contact:", error);
      return;
    }

    // Queue a notification to the client
    const { error: notifError } = await ctx.supabase
      .from("notifications")
      .insert({
        to_wa_id: data.whatsapp,
        notification_type: "insurance_reupload_request",
        payload: { text: MESSAGES.REUPLOAD_REQUEST, lead_id: leadId },
        status: "queued",
      });

    if (notifError) {
      await sendText(ctx.from, "❌ Failed to queue re-upload request.");
      console.error("Failed to queue notification:", notifError);
      return;
    }

    // Update lead status
    const { error: updateError } = await ctx.supabase
      .from("insurance_leads")
      .update({ status: "reupload_requested", updated_at: new Date().toISOString() })
      .eq("id", leadId);

    if (updateError) {
      console.error("Failed to update lead status:", updateError);
      // Don't return error to user since notification was queued successfully
    }

    await sendText(ctx.from, "✅ Re-upload request queued for delivery.");
  } catch (err) {
    await sendText(ctx.from, "❌ Error requesting re-upload.");
    console.error("Error requesting re-upload:", err);
  }
}

async function handleAssignOwner(
  ctx: RouterContext,
  state: ChatState,
): Promise<void> {
  const leadId = state.data?.leadId;
  if (!leadId) {
    await sendText(ctx.from, "❌ No lead selected.");
    return;
  }

  // For now, assign to the current admin
  try {
    const { error } = await ctx.supabase
      .from("insurance_leads")
      .update({ 
        status: "assigned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (error) {
      await sendText(ctx.from, "❌ Failed to assign owner.");
      console.error("Failed to assign owner:", error);
      return;
    }

    await sendText(ctx.from, `✅ Lead assigned to you (${ctx.from}).`);
  } catch (err) {
    await sendText(ctx.from, "❌ Error assigning owner.");
    console.error("Error assigning owner:", err);
  }
}

async function handleExportJSON(
  ctx: RouterContext,
  state: ChatState,
): Promise<void> {
  const leadId = state.data?.leadId;
  if (!leadId) {
    await sendText(ctx.from, "❌ No lead selected.");
    return;
  }

  try {
    const { data, error } = await ctx.supabase
      .from("insurance_leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (error || !data) {
      await sendText(ctx.from, "❌ Failed to fetch lead data.");
      console.error("Failed to fetch lead data:", error);
      return;
    }

    const jsonExport = JSON.stringify(data, null, 2);
    const preview = jsonExport.length > JSON_EXPORT_MAX_LENGTH
      ? jsonExport.substring(0, JSON_EXPORT_MAX_LENGTH) + "\n\n... (truncated)"
      : jsonExport;

    await sendText(ctx.from, `📄 Lead Export (JSON):\n\n\`\`\`json\n${preview}\n\`\`\``);
  } catch (err) {
    await sendText(ctx.from, "❌ Error exporting lead.");
    console.error("Error exporting lead:", err);
  }
}
