import type { RouterContext, WhatsAppMediaMessage } from "../types.ts";
import { handleVendorMenuMedia } from "../flows/vendor/menu.ts";
import { handleInsuranceMedia } from "../domains/insurance/index.ts";
import { handleBarWaiterAudio } from "../domains/bars/waiter_ai.ts";

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
  
  // Route audio to Waiter chat when active
  if (msg.type === "audio" && state.key === "bar_waiter_chat") {
    return await handleBarWaiterAudio(ctx, msg as any, state.data);
  }

  if (await handleInsuranceMedia(ctx, msg, state)) return true;
  if (await handleVendorMenuMedia(ctx, msg)) return true;
  return false;
}
