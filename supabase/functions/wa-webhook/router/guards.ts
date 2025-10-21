import type { RouterContext, WhatsAppMessage } from "../types.ts";
import { sendText } from "../wa/client.ts";
import { clearState } from "../state/store.ts";
import type { ChatState } from "../state/store.ts";
import { sendHomeMenu } from "../flows/home.ts";
import { DINE_STATE } from "../domains/dinein/state.ts";
import { t } from "../i18n/translator.ts";
import {
  getButtonReplyId,
  getTextBody,
  isInteractiveButtonMessage,
  isTextMessage,
} from "../utils/messages.ts";

const STOP_REGEX = /^\s*(stop|unsubscribe)\s*$/i;
const START_REGEX = /^\s*start\s*$/i;
const HOME_REGEX = /^\s*(home|menu)\s*$/i;

export async function runGuards(
  ctx: RouterContext,
  msg: WhatsAppMessage,
  state: ChatState,
): Promise<boolean> {
  if (isTextMessage(msg)) {
    const body = getTextBody(msg) ?? "";
    const inDineOnboarding = state.key
      ? [
        DINE_STATE.ONBOARD_IDENTITY,
        DINE_STATE.ONBOARD_LOCATION,
        DINE_STATE.ONBOARD_PAYMENT,
        DINE_STATE.ONBOARD_CONTACTS,
        DINE_STATE.ONBOARD_UPLOAD,
      ].includes(state.key as typeof DINE_STATE[keyof typeof DINE_STATE])
      : false;
    if (STOP_REGEX.test(body)) {
      if (inDineOnboarding) return false;
      const nowIso = new Date().toISOString();
      await ctx.supabase
        .from("contacts")
        .upsert({
          msisdn_e164: ctx.from,
          profile_id: ctx.profileId ?? null,
          opted_out: true,
          opted_in: false,
          opt_out_ts: nowIso,
          opt_in_ts: null,
          last_inbound_at: nowIso,
        }, { onConflict: "msisdn_e164" });
      await sendText(ctx.from, t(ctx.locale, "guards.stop.confirm"));
      return true;
    }
    if (START_REGEX.test(body)) {
      if (inDineOnboarding) return false;
      const nowIso = new Date().toISOString();
      await ctx.supabase
        .from("contacts")
        .upsert({
          msisdn_e164: ctx.from,
          profile_id: ctx.profileId ?? null,
          opted_out: false,
          opted_in: true,
          opt_in_ts: nowIso,
          opt_out_ts: null,
          last_inbound_at: nowIso,
        }, { onConflict: "msisdn_e164" });
      await sendText(ctx.from, t(ctx.locale, "guards.start.confirm"));
      if (ctx.profileId) {
        await clearState(ctx.supabase, ctx.profileId);
      }
      await sendHomeMenu(ctx);
      return true;
    }
    if (HOME_REGEX.test(body)) {
      if (inDineOnboarding) return false;
      if (ctx.profileId) {
        await clearState(ctx.supabase, ctx.profileId);
      }
      await sendHomeMenu(ctx);
      return true;
    }
  }
  if (isInteractiveButtonMessage(msg) &&
    getButtonReplyId(msg) === "back_home") {
    const key = state.key;
    if (
      key && [
        DINE_STATE.ONBOARD_IDENTITY,
        DINE_STATE.ONBOARD_LOCATION,
        DINE_STATE.ONBOARD_PAYMENT,
        DINE_STATE.ONBOARD_CONTACTS,
        DINE_STATE.ONBOARD_UPLOAD,
      ].includes(key as typeof DINE_STATE[keyof typeof DINE_STATE])
    ) {
      return false;
    }
    if (ctx.profileId) {
      await clearState(ctx.supabase, ctx.profileId);
    }
    await sendHomeMenu(ctx);
    return true;
  }
  return false;
}
