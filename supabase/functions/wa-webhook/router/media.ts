import type { RouterContext, WhatsAppMediaMessage } from "../types.ts";
import { handleVendorMenuMedia } from "../flows/vendor/menu.ts";
import { handleInsuranceMedia } from "../domains/insurance/index.ts";

export async function handleMedia(
  ctx: RouterContext,
  msg: WhatsAppMediaMessage,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (await handleInsuranceMedia(ctx, msg, state)) return true;
  if (await handleVendorMenuMedia(ctx, msg)) return true;
  return false;
}
