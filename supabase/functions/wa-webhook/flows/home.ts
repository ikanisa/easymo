import type { RouterContext } from "../types.ts";
import { sendList } from "../wa/client.ts";
import { IDS } from "../wa/ids.ts";
import { isAdminNumber } from "./admin/auth.ts";
import { maskPhone } from "./support.ts";

export async function sendHomeMenu(ctx: RouterContext): Promise<void> {
  const isAdmin = await isAdminNumber(ctx);
  const rows = [
    { id: IDS.SEE_DRIVERS, title: "Nearby Drivers" },
    { id: IDS.SEE_PASSENGERS, title: "Nearby Passengers" },
    { id: IDS.SCHEDULE_TRIP, title: "Schedule Trip" },
    { id: IDS.MARKETPLACE, title: "Marketplace" },
    { id: IDS.BASKETS, title: "Baskets" },
    { id: IDS.MOTOR_INSURANCE, title: "Motor Insurance" },
    { id: IDS.MOMO_QR, title: "MoMo QR" },
    { id: IDS.WALLET, title: "Wallet & Tokens" },
    { id: IDS.DINEIN_BARS, title: "Bars & Restaurants" },
  ];
  if (isAdmin) {
    rows.push({ id: IDS.ADMIN_HUB, title: "Admin" });
  }
  await sendList(ctx.from, {
    title: "easyMO Menu",
    body: `Hi ${maskPhone(ctx.from)}\nPick a service`,
    sectionTitle: "Options",
    rows,
  });
}
