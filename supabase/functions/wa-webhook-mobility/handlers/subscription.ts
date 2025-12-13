import type { RouterContext } from "../../types.ts";
import { gateProFeature } from "../../rpc/mobility.ts";
import { IDS } from "../../wa/ids.ts";
import { clearState, setState } from "../../state/store.ts";
import { sendButtonsMessage } from "../../utils/reply.ts";
import { t } from "../../i18n/translator.ts";
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
    await logStructuredEvent("DRIVER_SUBSCRIPTION_GATE_FAILED", {
      user_id: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    });
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
    t(ctx.locale, "mobility.sub.required"),
  ];
  if (creditsLeft > 0) {
    lines.push(
      t(ctx.locale, "mobility.sub.passes_remaining", {
        left: String(creditsLeft),
      }),
    );
  } else {
    lines.push(t(ctx.locale, "mobility.sub.passes_used_all"));
  }
  lines.push(t(ctx.locale, "mobility.sub.pay_prompt"));
  await sendButtonsMessage(
    ctx,
    lines.join("\n"),
    [
      {
        id: IDS.DRIVER_SUB_PAY,
        title: t(ctx.locale, "mobility.sub.pay_4_tok"),
      },
      { id: IDS.WALLET, title: t(ctx.locale, "common.wallet") },
      { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
    ],
  );
}

export async function handleDriverSubscriptionPay(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const { data, error } = await ctx.supabase.rpc(
      "mobility_buy_subscription",
      {
        _user_id: ctx.profileId,
      },
    );
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) {
      if (result?.message === "insufficient_tokens") {
        await sendButtonsMessage(
          ctx,
          t(ctx.locale, "mobility.sub.not_enough_tokens"),
          [
            { id: IDS.WALLET, title: t(ctx.locale, "common.wallet") },
            { id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") },
          ],
        );
        return true;
      }
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "mobility.sub.activate_fail"),
        [{ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }],
      );
      return true;
    }
    const expires = result?.expires_at
      ? new Date(result.expires_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
      : null;
    const lines = [
      t(ctx.locale, "mobility.sub.active"),
    ];
    if (expires) {
      lines.push(t(ctx.locale, "mobility.sub.valid_until", { date: expires }));
    }
    await sendButtonsMessage(
      ctx,
      lines.join("\n"),
      [{ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }],
    );
    await clearState(ctx.supabase, ctx.profileId);
    return true;
  } catch (error) {
    await logStructuredEvent("DRIVER_SUBSCRIPTION_PAY_FAILED", {
      user_id: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    });
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "mobility.sub.payment_failed"),
      [{ id: IDS.BACK_MENU, title: t(ctx.locale, "common.menu_back") }],
    );
    return true;
  }
}
