import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { recordAdminAudit } from "./audit.ts";

const LIMIT = 10;

function toBizRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    catalog_url: row.catalog_url,
    created_at: row.created_at,
  };
}

export async function handleAdminMarketplace(
  req: FlowExchangeRequest,
  ctx: { waId: string },
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_market_refresh":
    case "a_admin_open_marketplace":
      return await listBusinesses(req);
    case "a_admin_biz_approve":
      return await updateStatus(req, ctx.waId, "approved");
    case "a_admin_biz_hide":
      return await updateStatus(req, ctx.waId, "hidden");
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown marketplace action ${req.action_id}`,
        }],
      };
  }
}

async function listBusinesses(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const { data, error } = await supabase
    .from("business")
    .select("id, name, status, catalog_url, created_at")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to load marketplace." }],
    };
  }
  return {
    next_screen_id: "s_biz_list",
    data: {
      businesses: (data ?? []).map(toBizRow),
    },
  };
}

async function updateStatus(
  req: FlowExchangeRequest,
  adminWa: string,
  status: string,
): Promise<FlowExchangeResponse> {
  const bizId = typeof req.fields?.business_id === "string"
    ? req.fields.business_id
    : undefined;
  if (!bizId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing business id." }],
    };
  }
  const { error } = await supabase
    .from("business")
    .update({ status })
    .eq("id", bizId);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to update business." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_biz_status",
    targetId: bizId,
    after: { status },
  });
  return {
    next_screen_id: "s_biz_detail",
    messages: [{ level: "info", text: `Business marked ${status}.` }],
    data: { business_id: bizId, status },
  };
}
