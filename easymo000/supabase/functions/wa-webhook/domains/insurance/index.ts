import type { RouterContext } from "../../types.ts";
import { clearState, setState } from "../../state/store.ts";
import { IDS } from "../../wa/ids.ts";
import {
  buildButtons,
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";
import { sendHomeMenu } from "../../flows/home.ts";
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
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.MENU,
    data: {},
  });
  await sendListMessage(
    ctx,
    {
      title: "🛡️ Motor Insurance",
      body:
        "Share your insurance certificate for instant review and a quick summary.",
      sectionTitle: "Insurance",
      buttonText: "Open",
      rows: [
        {
          id: IDS.INSURANCE_SUBMIT,
          title: "Submit document",
          description: "Send a photo or PDF of your certificate.",
        },
        {
          id: IDS.INSURANCE_HELP,
          title: "Help",
          description: "See tips about accepted formats and quality.",
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
        "📄 Send a clear photo or PDF of your insurance certificate. You can upload multiple pages one after another.",
        buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
      );
      return true;
    }
    case IDS.INSURANCE_HELP: {
      await sendButtonsMessage(
        ctx,
        [
          "✅ Accepted formats: JPG, PNG, PDF",
          "📷 Tip: capture the full page in good lighting",
          "⏱️ Reviews happen within minutes during business hours",
        ].join("\n\n"),
        buildButtons({ id: IDS.MOTOR_INSURANCE, title: "Done" }),
      );
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
  const outcome = await processInsuranceDocument(ctx, msg, state.key);
  if (outcome === "ocr_ok" && ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, { key: STATES.MENU, data: {} });
  }
  return outcome !== "skipped";
}
