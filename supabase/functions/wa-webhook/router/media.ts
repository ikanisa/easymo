import type { RouterContext } from "../types.ts";
import { handleInsuranceMedia } from "../flows/insurance/ocr.ts";
import { handleVendorMenuMedia } from "../flows/vendor/menu.ts";

export async function handleMedia(ctx: RouterContext, msg: any, state: { key: string; data?: Record<string, unknown> }): Promise<boolean> {
  if (msg.type === "image" || msg.type === "document") {
    if (await handleVendorMenuMedia(ctx, msg)) return true;
    const handled = await handleInsuranceMedia(ctx, msg);
    if (handled) return true;
  }
  return false;
}
