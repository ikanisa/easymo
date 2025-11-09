import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import {
  AdminForbiddenError,
  AdminPinRequiredError,
  ensurePinSession,
  markPinSession,
  requireAdmin,
} from "./auth.ts";
import { logAdminDenied, recordAdminAudit } from "./audit.ts";

type AdminContext = {
  waId: string;
  normalized: string;
  isInsurance: boolean;
};

async function withAdminAuth(
  req: FlowExchangeRequest,
  fn: (ctx: AdminContext) => Promise<FlowExchangeResponse>,
): Promise<FlowExchangeResponse> {
  const waIdRaw = typeof req.wa_id === "string" ? req.wa_id : "";
  if (!waIdRaw) {
    await logStructuredEvent("ADMIN_DENIED", { reason: "missing_wa_id" });
    return {
      next_screen_id: req.screen_id,
      messages: [{
        level: "error",
        text: "Admin access requires a verified number.",
      }],
    };
  }

  try {
    const admin = await requireAdmin(waIdRaw);
    try {
      await ensurePinSession(waIdRaw, admin.config);
    } catch (err) {
      if (err instanceof AdminPinRequiredError) {
        await logStructuredEvent("ADMIN_PIN_REQUIRED", {
          wa_id: `***${admin.normalized.slice(-4)}`,
        });
        return {
          next_screen_id: "s_admin_pin",
          messages: [{
            level: "warning",
            text: "Enter admin PIN to continue.",
          }],
        };
      }
      throw err;
    }
    await logStructuredEvent("ADMIN_FLOW_ROUTED", {
      flow_id: req.flow_id,
      action_id: req.action_id,
      wa_id: `***${admin.normalized.slice(-4)}`,
    });
    return await fn({
      waId: waIdRaw,
      normalized: admin.normalized,
      isInsurance: admin.isInsuranceAdmin,
    });
  } catch (err) {
    if (err instanceof AdminForbiddenError) {
      await logAdminDenied(waIdRaw, req.action_id ?? "unknown", "not_admin");
      return {
        next_screen_id: req.screen_id,
        messages: [{ level: "error", text: "Admin access denied." }],
      };
    }
    if (err instanceof AdminPinRequiredError) {
      await logStructuredEvent("ADMIN_PIN_REQUIRED", {
        wa_id: `***${waIdRaw.slice(-4)}`,
      });
      return {
        next_screen_id: "s_admin_pin",
        messages: [{ level: "warning", text: "Enter admin PIN to continue." }],
      };
    }
    await logStructuredEvent("ADMIN_FLOW_ERROR", { error: String(err) });
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Admin request failed." }],
    };
  }
}

async function handlePinSubmit(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const pin = typeof req.fields?.pin === "string" ? req.fields.pin.trim() : "";
  if (!pin) {
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "PIN required." }],
    };
  }
  const waIdRaw = typeof req.wa_id === "string" ? req.wa_id : "";
  const admin = await requireAdmin(waIdRaw);
  const config = admin.config;
  if (!config.admin_pin_hash) {
    await markPinSession(waIdRaw);
    await recordAdminAudit({
      adminWaId: waIdRaw,
      action: "admin_pin_skipped",
      targetId: null,
      reason: "No PIN hash configured",
    });
    return {
      next_screen_id: "s_hub",
      messages: [{ level: "info", text: "PIN accepted." }],
    };
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
  if (hashHex !== config.admin_pin_hash) {
    await logStructuredEvent("ADMIN_PIN_FAIL", {
      wa_id: `***${admin.normalized.slice(-4)}`,
    });
    return {
      next_screen_id: req.screen_id,
      messages: [{ level: "error", text: "Invalid PIN." }],
    };
  }
  await markPinSession(waIdRaw);
  await recordAdminAudit({ adminWaId: waIdRaw, action: "admin_pin_ok" });
  return {
    next_screen_id: "s_hub",
    messages: [{ level: "info", text: "PIN accepted." }],
  };
}

import { handleAdminHub } from "./hub.ts";
import { handleAdminPlaceholder } from "./placeholder.ts";
import { handleAdminTrips } from "./trips.ts";
import { handleAdminMarketplace } from "./marketplace.ts";
import { handleAdminWallet } from "./wallet.ts";
import { handleAdminMomoQr } from "./momoqr.ts";
import { handleAdminPromoters } from "./promoters.ts";
import { handleAdminBroadcast } from "./broadcast.ts";
import { handleAdminTemplates } from "./templates.ts";
import { handleAdminVouchers } from "./vouchers.ts";
import { handleAdminReferrals } from "./referrals.ts";
import { handleAdminFreeze } from "./freeze.ts";
import { handleAdminDiagnostics } from "./diagnostics.ts";
import { handleAdminAlerts } from "./alerts.ts";
import { handleAdminSettings } from "./settings.ts";

export async function handleAdminFlow(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  if (req.action_id === "a_admin_pin_submit") {
    return await handlePinSubmit(req);
  }

  return withAdminAuth(req, async (ctx) => {
    switch (req.flow_id) {
      case "flow.admin.hub.v1":
        return await handleAdminHub(req, { waId: ctx.waId });
      case "flow.admin.trips.v1":
        return await handleAdminTrips(req, { waId: ctx.waId });
      case "flow.admin.insurance.v1":
      case "flow.admin.marketplace.v1":
        return await handleAdminMarketplace(req, { waId: ctx.waId });
      case "flow.admin.wallet.v1":
        return await handleAdminWallet(req, { waId: ctx.waId });
      case "flow.admin.momoqr.v1":
        return await handleAdminMomoQr(req, { waId: ctx.waId });
      case "flow.admin.promoters.v1":
        return await handleAdminPromoters(req, { waId: ctx.waId });
      case "flow.admin.broadcast.v1":
        return await handleAdminBroadcast(req, { waId: ctx.waId });
      case "flow.admin.templates.v1":
        return await handleAdminTemplates(req, { waId: ctx.waId });
      case "flow.admin.vouchers.v1":
        return await handleAdminVouchers(req, { waId: ctx.waId });
      case "flow.admin.referrals.v1":
        return await handleAdminReferrals(req, { waId: ctx.waId });
      case "flow.admin.freeze.v1":
        return await handleAdminFreeze(req, { waId: ctx.waId });
      case "flow.admin.diag.v1":
        return await handleAdminDiagnostics(req, { waId: ctx.waId });
      case "flow.admin.alerts.v1":
        return await handleAdminAlerts(req, { waId: ctx.waId });
      case "flow.admin.settings.v1":
        return await handleAdminSettings(req, { waId: ctx.waId });
      default:
        await recordAdminAudit({
          adminWaId: ctx.waId,
          action: "admin_flow_unknown",
          targetId: req.flow_id ?? null,
        });
        return {
          next_screen_id: req.screen_id,
          messages: [{
            level: "warning",
            text: `Admin flow ${req.flow_id} not yet available.`,
          }],
        };
    }
  });
}
