import type { RouterContext } from "../../types.ts";
import { gateProFeature } from "../../rpc/mobility.ts";
import { IDS } from "../../wa/ids.ts";
import { clearState, setState } from "../../state/store.ts";
import { sendButtonsMessage } from "../../utils/reply.ts";
import { sendText } from "../../wa/client.ts";
import { logStructuredEvent } from "../../observe/log.ts";

export const DRIVER_SUBSCRIPTION_STATE = "driver_subscription_prompt";

export async function ensureDriverAccess(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const gate = await gateProFeature(ctx.supabase, ctx.profileId);
    if (gate.access) {
      if (gate.used_credit) {
        await logStructuredEvent("DRIVER_CREDIT_USED", {
          user_id: ctx.profileId,
          credits_left: gate.credits_left ?? null,
        });
        if (typeof gate.credits_left === "number") {
          await sendText(
            ctx.from,
            `Driver pass used. ${gate.credits_left} passes remaining.`,
          );
        }
      }
      return true;
    }
    await promptDriverSubscription(ctx, gate.credits_left ?? 0);
    return false;
  } catch (error) {
    console.error("driver.subscription_gate_fail", error);
    await promptDriverSubscription(ctx, 0);
    return false;
  }
}

export async function promptDriverSubscription(
  ctx: RouterContext,
  creditsLeft: number,
): Promise<void> {
  if (!ctx.profileId) return;
  await setState(ctx.supabase, ctx.profileId, {
    key: DRIVER_SUBSCRIPTION_STATE,
    data: { creditsLeft },
  });
  const lines = [
    "🚧 Driver subscription required.",
  ];
  if (creditsLeft > 0) {
    lines.push(`Driver passes remaining: ${creditsLeft}. Each driver action uses one pass.`);
  } else {
    lines.push("You've used all 30 free driver passes.");
  }
  lines.push(
    "Pay 4 TOK (pegged 1 TOK = 1 USD) to unlock 30 days of unlimited driver matches.",
  );
  await sendButtonsMessage(
    ctx,
    lines.join("\n"),
    [
      { id: IDS.DRIVER_SUB_PAY, title: "Pay 4 TOK" },
      { id: IDS.WALLET, title: "💎 Wallet" },
      { id: IDS.BACK_MENU, title: "↩️ Menu" },
    ],
  );
}

export async function handleDriverSubscriptionPay(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const { data, error } = await ctx.supabase.rpc("mobility_buy_subscription", {
      _user_id: ctx.profileId,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) {
      if (result?.message === "insufficient_tokens") {
        await sendButtonsMessage(
          ctx,
          "⚠️ Not enough tokens. Top up your wallet and try again.",
          [
            { id: IDS.WALLET, title: "💎 Wallet" },
            { id: IDS.BACK_MENU, title: "↩️ Menu" },
          ],
        );
        return true;
      }
      await sendButtonsMessage(
        ctx,
        "⚠️ Couldn't activate subscription. Please try again shortly.",
        [{ id: IDS.BACK_MENU, title: "↩️ Menu" }],
      );
      return true;
    }
    const expires = result?.expires_at
      ? new Date(result.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : null;
    const lines = [
      "✅ Driver subscription active!",
    ];
    if (expires) {
      lines.push(`Valid until ${expires}.`);
    }
    await sendButtonsMessage(
      ctx,
      lines.join("\n"),
      [{ id: IDS.BACK_MENU, title: "↩️ Menu" }],
    );
    await clearState(ctx.supabase, ctx.profileId);
    return true;
  } catch (error) {
    console.error("driver.subscription_pay_fail", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Payment failed. Please try again later.",
      [{ id: IDS.BACK_MENU, title: "↩️ Menu" }],
    );
    return true;
  }
}
