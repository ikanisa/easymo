import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { recordAdminAudit } from "./audit.ts";
import { logStructuredEvent } from "../../observe/log.ts";

const LIST_LIMIT = 10;

function toBasketRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    join_token: row.join_token,
    created_at: row.created_at,
  };
}

export async function handleAdminBaskets(
  req: FlowExchangeRequest,
  ctx: { waId: string },
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_baskets_refresh":
    case "a_admin_open_baskets":
      return await listBaskets(req);
    case "a_admin_basket_approve":
      return await approveBasket(req, ctx.waId);
    case "a_admin_basket_revoke":
      return await revokeBasket(req, ctx.waId);
    case "a_admin_basket_regen":
      return await regenerateToken(req, ctx.waId);
    case "a_admin_basket_close":
      return await closeBasket(req, ctx.waId);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown basket action ${req.action_id}`,
        }],
      };
  }
}

async function listBaskets(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const { data, error } = await supabase
    .from("baskets")
    .select("id, name, type, status, join_token, created_at")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) {
    await logStructuredEvent("ADMIN_BASKETS_LIST_FAIL", {
      error: error.message,
    });
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to load baskets." }],
    };
  }
  await logStructuredEvent("ADMIN_BASKETS_LIST_OK", {
    count: data?.length ?? 0,
  });
  return {
    next_screen_id: "s_baskets_list",
    data: {
      baskets: (data ?? []).map(toBasketRow),
    },
  };
}

async function approveBasket(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const basketId = typeof req.fields?.basket_id === "string"
    ? req.fields.basket_id
    : undefined;
  if (!basketId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing basket id." }],
    };
  }
  const { error } = await supabase
    .from("baskets")
    .update({ type: "public", join_token_revoked: false })
    .eq("id", basketId);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to approve basket." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_basket_approve",
    targetId: basketId,
  });
  return {
    next_screen_id: "s_basket_detail",
    messages: [{ level: "info", text: "Basket approved." }],
    data: { basket_id: basketId, type: "public" },
  };
}

async function revokeBasket(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const basketId = typeof req.fields?.basket_id === "string"
    ? req.fields.basket_id
    : undefined;
  if (!basketId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing basket id." }],
    };
  }
  const { error } = await supabase
    .from("baskets")
    .update({ join_token_revoked: true })
    .eq("id", basketId);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to revoke token." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_basket_revoke",
    targetId: basketId,
  });
  return {
    next_screen_id: "s_basket_detail",
    messages: [{ level: "info", text: "Basket token revoked." }],
    data: { basket_id: basketId, join_token_revoked: true },
  };
}

async function regenerateToken(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const basketId = typeof req.fields?.basket_id === "string"
    ? req.fields.basket_id
    : undefined;
  if (!basketId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing basket id." }],
    };
  }
  const newToken = crypto.randomUUID().slice(0, 6).toUpperCase();
  const { error } = await supabase
    .from("baskets")
    .update({ join_token: newToken, join_token_revoked: false })
    .eq("id", basketId);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to regenerate token." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_basket_regen",
    targetId: basketId,
  });
  return {
    next_screen_id: "s_basket_detail",
    messages: [{ level: "info", text: "New token generated." }],
    data: { basket_id: basketId, join_token: newToken },
  };
}

async function closeBasket(
  req: FlowExchangeRequest,
  adminWa: string,
): Promise<FlowExchangeResponse> {
  const basketId = typeof req.fields?.basket_id === "string"
    ? req.fields.basket_id
    : undefined;
  const reason = typeof req.fields?.reason === "string"
    ? req.fields.reason
    : null;
  if (!basketId) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Missing basket id." }],
    };
  }
  const { error } = await supabase
    .from("baskets")
    .update({ status: "closed" })
    .eq("id", basketId);
  if (error) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Failed to close basket." }],
    };
  }
  await recordAdminAudit({
    adminWaId: adminWa,
    action: "admin_basket_close",
    targetId: basketId,
    reason,
  });
  return {
    next_screen_id: "s_basket_detail",
    messages: [{ level: "info", text: "Basket closed." }],
    data: { basket_id: basketId, status: "closed" },
  };
}
