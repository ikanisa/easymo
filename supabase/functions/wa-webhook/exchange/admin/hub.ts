import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { recordAdminAudit } from "./audit.ts";

const HUB_SECTIONS = {
  operations: [
    { id: "ADMIN::OPS_TRIPS", title: "Trips (live)" },
    { id: "ADMIN::OPS_MARKETPLACE", title: "Marketplace" },
    { id: "ADMIN::OPS_WALLET", title: "Wallet & tokens" },
    { id: "ADMIN::OPS_MOMO", title: "MoMo QR" },
  ],
  growth: [
    { id: "ADMIN::GROW_PROMOTERS", title: "Promoters" },
    { id: "ADMIN::GROW_BROADCAST", title: "Broadcast" },
    { id: "ADMIN::GROW_TEMPLATES", title: "Templates" },
  ],
  trust: [
    { id: "ADMIN::TRUST_REFERRALS", title: "Referrals" },
    { id: "ADMIN::TRUST_FREEZE", title: "Freeze account" },
  ],
  diagnostics: [
    { id: "ADMIN::DIAG_MATCH", title: "Match diag" },
    { id: "ADMIN::DIAG_INSURANCE", title: "Insurance diag" },
    { id: "ADMIN::DIAG_HEALTH", title: "System health" },
    { id: "ADMIN::DIAG_LOGS", title: "Logs" },
  ],
};

type AdminContext = {
  waId: string;
};

export async function handleAdminHub(
  req: FlowExchangeRequest,
  admin: AdminContext,
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_admin_open_today":
      await recordAdminAudit({
        adminWaId: admin.waId,
        action: "admin_open_today",
      });
      return {
        next_screen_id: "s_today",
        messages: [{ level: "info", text: "Today dashboard coming soon." }],
      };
    case "a_admin_open_alerts":
      await recordAdminAudit({
        adminWaId: admin.waId,
        action: "admin_open_alerts",
      });
      return {
        next_screen_id: "s_alerts",
        data: {},
      };
    case "a_admin_open_settings":
      await recordAdminAudit({
        adminWaId: admin.waId,
        action: "admin_open_settings",
      });
      return {
        next_screen_id: "s_settings",
        data: {},
      };
    case "a_admin_open_flow": {
      const rowId = typeof req.fields?.row_id === "string"
        ? req.fields.row_id
        : undefined;
      if (!rowId) {
        return {
          next_screen_id: req.screen_id,
          messages: [{ level: "error", text: "Missing selection." }],
        };
      }
      await recordAdminAudit({
        adminWaId: admin.waId,
        action: "admin_hub_open",
        targetId: rowId,
      });
      const mapping: Record<string, string> = {
        "ADMIN::OPS_TRIPS": "flow.admin.trips.v1",
        "ADMIN::OPS_MARKETPLACE": "flow.admin.marketplace.v1",
        "ADMIN::OPS_WALLET": "flow.admin.wallet.v1",
        "ADMIN::OPS_MOMO": "flow.admin.momoqr.v1",
        "ADMIN::GROW_PROMOTERS": "flow.admin.promoters.v1",
        "ADMIN::GROW_BROADCAST": "flow.admin.broadcast.v1",
        "ADMIN::GROW_TEMPLATES": "flow.admin.templates.v1",
        "ADMIN::TRUST_REFERRALS": "flow.admin.referrals.v1",
        "ADMIN::TRUST_FREEZE": "flow.admin.freeze.v1",
        "ADMIN::DIAG_MATCH": "flow.admin.diag.v1",
        "ADMIN::DIAG_INSURANCE": "flow.admin.diag.v1",
        "ADMIN::DIAG_HEALTH": "flow.admin.diag.v1",
        "ADMIN::DIAG_LOGS": "flow.admin.diag.v1",
      };
      const targetFlow = mapping[rowId];
      if (!targetFlow) {
        return {
          next_screen_id: req.screen_id,
          messages: [{ level: "warning", text: "Selection coming soon." }],
        };
      }
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "info",
          text: `Launch ${targetFlow} via quick reply.`,
        }],
        data: { launch_flow_id: targetFlow },
      };
    }
    case "a_admin_refresh_hub":
    case "a_admin_load_hub":
    default:
      return {
        next_screen_id: "s_hub",
        data: {
          sections: {
            operations: HUB_SECTIONS.operations,
            growth: HUB_SECTIONS.growth,
            trust: HUB_SECTIONS.trust,
            diagnostics: HUB_SECTIONS.diagnostics,
          },
        },
      };
  }
}
