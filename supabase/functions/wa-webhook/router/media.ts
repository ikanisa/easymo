import type { RouterContext, WhatsAppMediaMessage } from "../types.ts";
import { handleVendorMenuMedia } from "../flows/vendor/menu.ts";
import { handleInsuranceMedia } from "../domains/insurance/index.ts";

export async function handleMedia(
  ctx: RouterContext,
  msg: WhatsAppMediaMessage,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  // Handle vehicle certificate upload
  if (state.key === "profile_add_vehicle") {
    const stateData = state.data as { stage?: string };
    if (stateData.stage === "upload_certificate" && msg.image) {
      const { handleVehicleCertificateMedia } = await import(
        "../domains/profile/index.ts"
      );
      return await handleVehicleCertificateMedia(ctx, msg);
    }
  }
  
  if (await handleInsuranceMedia(ctx, msg, state)) return true;
  if (await handleVendorMenuMedia(ctx, msg)) return true;
  return false;
}
