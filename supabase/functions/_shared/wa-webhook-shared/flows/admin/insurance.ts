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
  _ctx: RouterContext,
): Promise<AdminLead[]> {
  // Placeholder data until Supabase integration ships.
  return [
    { id: "lead-1", title: "RAB123C • Radiant" },
    { id: "lead-2", title: "RAD987Q • Jubilee" },
  ];
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
      await sendText(ctx.from, "Insurance DM flow coming soon.");
      return true;
    case IDS.ADMIN_INSURANCE_REVIEW_SUBMIT:
      await sendText(ctx.from, "Insurance review flow coming soon.");
      return true;
    case IDS.ADMIN_INSURANCE_REQUEST_SUBMIT:
      await sendText(ctx.from, "Insurance re-upload request coming soon.");
      return true;
    case IDS.ADMIN_INSURANCE_ASSIGN_SUBMIT:
      await sendText(ctx.from, "Insurance owner assignment coming soon.");
      return true;
    case IDS.ADMIN_INSURANCE_EXPORT_SUBMIT:
      await sendText(ctx.from, "Insurance export flow coming soon.");
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
