import type { RouterContext } from "../../types.ts";
import type { ChatState } from "../../state/store.ts";
import { sendText } from "../../wa/client.ts";
import { ADMIN_ROW_IDS } from "./hub.ts";
import { ensureAdmin } from "./state.ts";

export async function handleAdminRow(
  ctx: RouterContext,
  id: string,
  state: ChatState,
): Promise<boolean> {
  const allowed = await ensureAdmin(ctx);
  if (!allowed) return true;

  switch (id) {
    case ADMIN_ROW_IDS.DIAG_MENU_RECONCILE: {
      try {
        const { data, error } = await ctx.supabase.rpc('reconcile_menu_business_links');
        const updated = typeof data === 'number' ? data : 0;
        if (error) throw error;
        await sendText(
          ctx.from,
          `Reconcile complete. Updated ${updated} restaurant_menu_items business links.`,
        );
      } catch (err) {
        await sendText(
          ctx.from,
          `Reconcile failed: ${err instanceof Error ? err.message : String(err ?? 'error')}`,
        );
      }
      return true;
    }
    case ADMIN_ROW_IDS.OPS_TRIPS:
    case ADMIN_ROW_IDS.OPS_MARKETPLACE:
    case ADMIN_ROW_IDS.OPS_WALLET:
    case ADMIN_ROW_IDS.OPS_MOMO:
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
