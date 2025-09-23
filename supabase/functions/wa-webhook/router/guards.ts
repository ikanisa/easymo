import type { RouterContext } from "../types.ts";
import { sendText } from "../wa/client.ts";
import { clearState } from "../state/store.ts";
import { sendHomeMenu } from "../flows/home.ts";

const STOP_REGEX = /^\s*(stop|unsubscribe)\s*$/i;
const START_REGEX = /^\s*start\s*$/i;
const HOME_REGEX = /^\s*(home|menu)\s*$/i;

export async function runGuards(ctx: RouterContext, msg: any): Promise<boolean> {
  if (msg.type === "text") {
    const body: string = msg.text?.body ?? "";
    if (STOP_REGEX.test(body)) {
      await ctx.supabase
        .from("contacts")
        .upsert({
          msisdn_e164: ctx.from,
          opted_out: true,
          opted_in: false,
          opt_out_ts: new Date().toISOString(),
        }, { onConflict: "msisdn_e164" });
      await sendText(ctx.from, "You have been opted out. Reply START to opt back in.");
      return true;
    }
    if (START_REGEX.test(body)) {
      await ctx.supabase
        .from("contacts")
        .upsert({
          msisdn_e164: ctx.from,
          opted_out: false,
          opted_in: true,
          opt_in_ts: new Date().toISOString(),
        }, { onConflict: "msisdn_e164" });
      await sendText(ctx.from, "You are now opted in. Sending menu...");
      if (ctx.profileId) {
        await clearState(ctx.supabase, ctx.profileId);
      }
      await sendHomeMenu(ctx);
      return true;
    }
    if (HOME_REGEX.test(body)) {
      if (ctx.profileId) {
        await clearState(ctx.supabase, ctx.profileId);
      }
      await sendHomeMenu(ctx);
      return true;
    }
  }
  if (msg.interactive?.type === "button_reply" && msg.interactive.button_reply?.id === "back_home") {
    if (ctx.profileId) {
      await clearState(ctx.supabase, ctx.profileId);
    }
    await sendHomeMenu(ctx);
    return true;
  }
  return false;
}
