import type { RouterContext } from "../../types.ts";
import type { ChatState } from "../../state/store.ts";
import { ADMIN_STATE, nextAdminBack } from "./state.ts";
import { openAdminHub, showAdminHubList } from "./hub.ts";
import {
  showAdminVouchersEntry,
  showAdminVouchersMenu,
  showVoucherRecentEntry,
} from "./vouchers.ts";
import {
  hydrateInsuranceLeads,
  showAdminInsuranceEntry,
  showAdminInsuranceList,
  showInsuranceDetailEntry,
  showInsuranceDetailMenu,
  showInsuranceMoreEntry,
  showInsuranceMoreMenu,
} from "./insurance.ts";

export async function handleAdminBack(
  ctx: RouterContext,
  state: ChatState,
): Promise<boolean> {
  const target = nextAdminBack(state);
  if (!target) return false;
  switch (target) {
    case ADMIN_STATE.ENTRY:
      await openAdminHub(ctx);
      return true;
    case ADMIN_STATE.HUB_LIST:
      await showAdminHubList(ctx);
      return true;
    case ADMIN_STATE.VOUCHERS_ENTRY:
      await showAdminVouchersEntry(ctx);
      return true;
    case ADMIN_STATE.VOUCHERS_LIST:
      await showAdminVouchersMenu(ctx);
      return true;
    case ADMIN_STATE.VOUCHERS_FORM:
      await showAdminVouchersMenu(ctx);
      return true;
    case ADMIN_STATE.VOUCHERS_RECENT_ENTRY:
      await showVoucherRecentEntry(ctx);
      return true;
    case ADMIN_STATE.VOUCHERS_RECENT_LIST:
      await showVoucherRecentEntry(ctx);
      return true;
    case ADMIN_STATE.INSURANCE_ENTRY:
      await showAdminInsuranceEntry(ctx);
      return true;
    case ADMIN_STATE.INSURANCE_LIST: {
      const leads = Array.isArray(state.data?.leads)
        ? state.data?.leads
        : await hydrateInsuranceLeads(ctx);
      await showAdminInsuranceList(ctx, leads);
      return true;
    }
    case ADMIN_STATE.INSURANCE_DETAIL: {
      const leadId = typeof state.data?.leadId === "string"
        ? state.data.leadId
        : null;
      const title = typeof state.data?.title === "string"
        ? state.data.title
        : "Lead";
      if (!leadId) {
        await showAdminInsuranceEntry(ctx);
        return true;
      }
      await showInsuranceDetailEntry(ctx, leadId, title);
      return true;
    }
    case ADMIN_STATE.INSURANCE_DETAIL_MENU: {
      await showInsuranceDetailMenu(ctx, state);
      return true;
    }
    case ADMIN_STATE.INSURANCE_MORE: {
      await showInsuranceDetailMenu(ctx, state);
      return true;
    }
    case ADMIN_STATE.INSURANCE_MORE_LIST: {
      await showInsuranceMoreMenu(ctx, state);
      return true;
    }
    default:
      return false;
  }
}
