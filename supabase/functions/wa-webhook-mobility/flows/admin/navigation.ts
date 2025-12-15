import type { RouterContext } from "../../types.ts";
import type { ChatState } from "../../state/store.ts";
import { ADMIN_STATE, nextAdminBack } from "./state.ts";
import { openAdminHub, showAdminHubList } from "./hub.ts";

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
    default:
      return false;
  }
}
