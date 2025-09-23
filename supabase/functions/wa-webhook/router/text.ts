import type { RouterContext } from "../types.ts";
import { sendHomeMenu } from "../flows/home.ts";
import { handleBasketText } from "../flows/baskets.ts";
import { handleMarketplaceText } from "../flows/marketplace.ts";
import { handleMomoText } from "../flows/momo/qr.ts";
import { handleWalletText } from "../flows/wallet/home.ts";
import { handleAdminCommand } from "../flows/admin/commands.ts";

export async function handleText(
  ctx: RouterContext,
  msg: any,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const body = (msg.text?.body ?? "").trim();
  if (!body) return false;
  if (body.startsWith("/")) {
    return await handleAdminCommand(ctx, body);
  }
  if (
    state.key === "mobility_nearby_select" ||
    state.key === "mobility_nearby_location"
  ) {
    return false; // expect list or location
  }
  if (await handleMomoText(ctx, body, state)) {
    return true;
  }
  if (await handleWalletText(ctx, body, state)) {
    return true;
  }
  if (await handleMarketplaceText(ctx, body, state)) {
    return true;
  }
  if (await handleBasketText(ctx, body, state)) {
    return true;
  }
  await sendHomeMenu(ctx);
  return true;
}
