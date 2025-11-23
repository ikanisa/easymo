import type { RouterContext, WhatsAppMediaMessage } from "../types.ts";
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
  
  // Vendor menu removed - vendors don't have menus (only bars/restaurants)
  return false;
}
