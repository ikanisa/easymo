import type { RouterContext } from "../../types.ts";
import type { ChatState } from "../../state/store.ts";
import { sendText } from "../../wa/client.ts";
import { ADMIN_ROW_IDS } from "./hub.ts";
import { ensureAdmin } from "./state.ts";
import {
  handleAdminInsuranceRow,
  showAdminInsuranceEntry,
} from "./insurance.ts";

export async function handleAdminRow(
  ctx: RouterContext,
  id: string,
  state: ChatState,
): Promise<boolean> {
  if (await handleAdminInsuranceRow(ctx, id, state)) return true;

  const allowed = await ensureAdmin(ctx);
  if (!allowed) return true;

  switch (id) {
    case ADMIN_ROW_IDS.OPS_INSURANCE:
      await showAdminInsuranceEntry(ctx);
      return true;
    case ADMIN_ROW_IDS.OPS_TRIPS:
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
      const { t } = await import("../../i18n/translator.ts");
      await sendText(ctx.from, t(ctx.locale, "admin.module.coming_soon"));
      return true;
    default:
      return false;
  }
}
