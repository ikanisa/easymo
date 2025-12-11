/**
 * Simplified Insurance Menu & Routing
 * NO OCR - just forward documents to admins
 */

import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { clearState, setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { sendListMessage, sendButtonsMessage, buildButtons } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { sendHomeMenu } from "../../_shared/wa-webhook-shared/flows/home.ts";
import { handleDocumentUpload, handleChatRequest } from "./simple_flow.ts";
import { fetchWhatsAppMedia } from "../../_shared/wa-webhook-shared/utils/media.ts";

const STATES = {
  MENU: "insurance_menu",
  WAIT_CERTIFICATE: "ins_wait_certificate",
  WAIT_CARTE_JAUNE: "ins_wait_carte_jaune",
} as const;

type InsuranceState = { key: string; data?: Record<string, unknown> };

export async function startInsurance(
  ctx: RouterContext,
  _state: InsuranceState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await logStructuredEvent("INSURANCE_MENU_START", { from: ctx.from });
  
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.MENU,
    data: {},
  });
  
  await sendListMessage(
    ctx,
    {
      title: "🛡️ Motor Insurance",
      body: "Send us your insurance documents or chat with our team. We'll forward everything to our insurance experts who will contact you directly.",
      sectionTitle: "Insurance Options",
      buttonText: "Choose",
      rows: [
        {
          id: "ins_send_certificate",
          title: "📄 Send Certificate",
          description: "Upload your insurance certificate",
        },
        {
          id: "ins_send_carte_jaune",
          title: "🟡 Send Carte Jaune",
          description: "Upload your yellow card (carte jaune)",
        },
        {
          id: "ins_chat_team",
          title: "💬 Chat with Team",
          description: "Connect directly with our insurance team",
        },
        {
          id: IDS.BACK_MENU,
          title: "← Back",
          description: "Return to the home menu",
        },
      ],
    },
    { emoji: "🛡️" },
  );
  
  return true;
}

export async function handleInsuranceListSelection(
  ctx: RouterContext,
  state: InsuranceState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  switch (id) {
    case "ins_send_certificate": {
      await setState(ctx.supabase, ctx.profileId, {
        key: STATES.WAIT_CERTIFICATE,
        data: {},
      });
      await sendButtonsMessage(
        ctx,
        "📄 Please send your insurance certificate as an image or PDF.\n\nIt will be forwarded directly to our insurance team.",
        buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
      );
      return true;
    }
    
    case "ins_send_carte_jaune": {
      await setState(ctx.supabase, ctx.profileId, {
        key: STATES.WAIT_CARTE_JAUNE,
        data: {},
      });
      await sendButtonsMessage(
        ctx,
        "🟡 Please send your Carte Jaune (Yellow Card) as an image or PDF.\n\nIt will be forwarded directly to our insurance team.",
        buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
      );
      return true;
    }
    
    case "ins_chat_team": {
      const userName = ctx.name || "User";
      const result = await handleChatRequest(ctx.supabase, ctx.from, userName);
      await sendText(ctx.from, result.message);
      if (result.success) {
        await clearState(ctx.supabase, ctx.profileId);
      }
      return true;
    }
    
    case IDS.BACK_MENU: {
      await clearState(ctx.supabase, ctx.profileId);
      await sendHomeMenu(ctx);
      return true;
    }
    
    default:
      return false;
  }
}

export async function handleInsuranceMedia(
  ctx: RouterContext,
  msg: Record<string, unknown>,
  state: InsuranceState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  const documentType = state.key === STATES.WAIT_CERTIFICATE 
    ? "certificate" 
    : "carte_jaune";
  
  try {
    const mediaId = (msg.image as any)?.id || (msg.document as any)?.id;
    const mimeType = (msg.image as any)?.mime_type || (msg.document as any)?.mime_type || "image/jpeg";
    
    if (!mediaId) {
      await sendText(ctx.from, "Sorry, couldn't process your file. Please try again.");
      return true;
    }
    
    const mediaResult = await fetchWhatsAppMedia(mediaId);
    if (!mediaResult) {
      await sendText(ctx.from, "Sorry, couldn't download your file. Please try again.");
      return true;
    }
    
    await sendText(ctx.from, "⏳ Processing your document...");
    
    const userName = ctx.name || "User";
    const result = await handleDocumentUpload(
      ctx.supabase,
      ctx.from,
      userName,
      documentType,
      mediaId,
      "", // We'll use mediaId instead of URL for forwarding
      mediaResult.mime
    );
    
    await sendText(ctx.from, result.message);
    
    if (result.success) {
      await clearState(ctx.supabase, ctx.profileId);
    }
    
    return true;
  } catch (error) {
    await logStructuredEvent("INSURANCE_MEDIA_ERROR", {
      error: error instanceof Error ? error.message : String(error),
      from: ctx.from
    }, "error");
    
    await sendText(ctx.from, "Sorry, something went wrong. Please try again or contact us directly.");
    return true;
  }
}
