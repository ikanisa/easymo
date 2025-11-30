import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { clearState, setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import {
  buildButtons,
  sendButtonsMessage,
  sendListMessage,
} from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { sendHomeMenu } from "../../_shared/wa-webhook-shared/flows/home.ts";
import { processInsuranceDocument } from "./ins_handler.ts";

const STATES = {
  MENU: "insurance_menu",
  UPLOAD: "ins_wait_doc",
} as const;

type InsuranceState = { key: string; data?: Record<string, unknown> };

export async function startInsurance(
  ctx: RouterContext,
  _state: InsuranceState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await logStructuredEvent("INFO", { data: "insurance.menu.start", from: ctx.from });
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.MENU,
    data: {},
  });
  await sendListMessage(
    ctx,
    {
      title: "🛡️ Motor Insurance",
      body:
        "Upload a clear insurance certificate photo or PDF. We’ll read it, summarize the details, and notify our insurance experts instantly.",
      sectionTitle: "Insurance",
      buttonText: "Open",
      rows: [
        {
          id: IDS.INSURANCE_SUBMIT,
          title: "Submit certificate",
          description: "Send a clear photo/PDF and we auto-fill all fields.",
        },
        {
          id: IDS.INSURANCE_HELP,
          title: "Help",
          description: "Chat with an insurance specialist on WhatsApp.",
        },
        {
          id: IDS.BACK_MENU,
          title: "← Back",
          description: "Return to the home menu.",
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
    case IDS.INSURANCE_SUBMIT: {
      await setState(ctx.supabase, ctx.profileId, {
        key: STATES.UPLOAD,
        data: {},
      });
      await sendButtonsMessage(
        ctx,
        "📄 Send a clear photo or PDF of your insurance certificate. You can upload multiple pages one after another so we capture the full document.",
        buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
      );
      return true;
    }
    case IDS.INSURANCE_HELP: {
      const { handleInsuranceHelp } = await import("./ins_handler.ts");
      return await handleInsuranceHelp(ctx);
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
  await logStructuredEvent("INFO", { data: "insurance.ocr.media", from: ctx.from, state: state.key });
  const outcome = await processInsuranceDocument(ctx, msg, state.key);
  
  if (outcome === "ocr_ok" && ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, { key: STATES.MENU, data: {} });
    return true;
  } else if (outcome === "ocr_queued") {
    await sendText(ctx.from, "Processing document...");
    return true;
  } else if (outcome === "skipped") {
    // Skipped means either wrong state or already processed - both are "handled" scenarios
    return true;
  }
  
  // ocr_error - still handled, error was logged internally
  return true;
}
