import type { RouterContext } from "../../types.ts";
import { sendText } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { isAdminNumber } from "./auth.ts";

export async function handleAdminQuickAction(ctx: RouterContext, id: string): Promise<void> {
  if (!(await isAdminNumber(ctx))) {
    await sendText(ctx.from, "Admin tools are restricted.");
    return;
  }
  switch (id) {
    case IDS.ADMIN_TODAY:
      await sendText(ctx.from, "Admin Today snapshot coming soon.");
      break;
    case IDS.ADMIN_ALERTS:
      await sendText(ctx.from, "Admin alerts toggle coming soon.");
      break;
    case IDS.ADMIN_SETTINGS:
      await sendText(ctx.from, "Admin settings coming soon.");
      break;
  }
}
