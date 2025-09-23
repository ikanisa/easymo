import type { RouterContext } from "../../types.ts";
import { sendList, sendText } from "../../wa/client.ts";
import {
  listWalletRedeemOptions,
  type WalletRedeemOption,
} from "../../rpc/wallet.ts";
import { resendWalletMenu } from "./home.ts";
import { setState } from "../../state/store.ts";
import { logWalletAdjust } from "../../observe/log.ts";

const STATE_KEY = "wallet_redeem";

type RedeemState = { key: string; data?: { options: WalletRedeemOption[] } };

export async function showWalletRedeem(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const options = await listWalletRedeemOptions(ctx.supabase, ctx.profileId);
    if (!options.length) {
      await sendText(ctx.from, "No redeem options available yet.");
      await resendWalletMenu(ctx);
      return true;
    }
    await setState(ctx.supabase, ctx.profileId, {
      key: STATE_KEY,
      data: { options },
    });
    await sendList(ctx.from, {
      title: "Redeem tokens",
      body: "Pick a reward.",
      sectionTitle: "Rewards",
      rows: options.slice(0, 10).map((opt) => ({
        id: opt.id,
        title: opt.title ?? "Reward",
        description: opt.description ?? "",
      })),
    });
  } catch (error) {
    console.error("wallet.redeem_fail", error);
    await sendText(ctx.from, "Couldn't load rewards. Try again later.");
    await resendWalletMenu(ctx);
  }
  return true;
}

export async function handleWalletRedeemSelection(
  ctx: RouterContext,
  state: RedeemState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== STATE_KEY) return false;
  const options = state.data?.options ?? [];
  const match = options.find((opt) => opt.id === id);
  if (!match) {
    await sendText(ctx.from, "Reward not found.");
    await resendWalletMenu(ctx);
    return true;
  }
  const lines: string[] = [match.title ?? "Reward"];
  if (match.description) lines.push(match.description);
  if (typeof match.cost_tokens === "number") {
    lines.push(`Cost: ${match.cost_tokens} tokens`);
  }
  if (match.instructions) lines.push(match.instructions);
  await sendText(ctx.from, lines.join("\n"));
  await logWalletAdjust({
    actor: ctx.from,
    action: "redeem_view",
    cost: match.cost_tokens ?? 0,
  });
  await resendWalletMenu(ctx);
  return true;
}
