import type { RouterContext } from "../../types.ts";
import { sendText } from "../../wa/client.ts";
import { ADMIN_ROW_IDS } from "./hub.ts";
import { isAdminNumber } from "./auth.ts";

export async function handleAdminRow(ctx: RouterContext, id: string): Promise<boolean> {
  if (!(await isAdminNumber(ctx))) {
    await sendText(ctx.from, "Admin tools are restricted.");
    return true;
  }
  switch (id) {
    case ADMIN_ROW_IDS.OPS_TRIPS:
    case ADMIN_ROW_IDS.OPS_BASKETS:
    case ADMIN_ROW_IDS.OPS_INSURANCE:
    case ADMIN_ROW_IDS.OPS_MARKETPLACE:
    case ADMIN_ROW_IDS.OPS_WALLET:
    case ADMIN_ROW_IDS.OPS_MOMO:
    case ADMIN_ROW_IDS.GROW_PROMOTERS:
    case ADMIN_ROW_IDS.GROW_BROADCAST:
    case ADMIN_ROW_IDS.GROW_TEMPLATES:
    case ADMIN_ROW_IDS.TRUST_REFERRALS:
    case ADMIN_ROW_IDS.TRUST_FREEZE:
    case ADMIN_ROW_IDS.DIAG_MATCH:
    case ADMIN_ROW_IDS.DIAG_INSURANCE:
    case ADMIN_ROW_IDS.DIAG_HEALTH:
    case ADMIN_ROW_IDS.DIAG_LOGS:
      await sendText(ctx.from, "Admin module coming online soon.");
      return true;
    default:
      return false;
  }
}
