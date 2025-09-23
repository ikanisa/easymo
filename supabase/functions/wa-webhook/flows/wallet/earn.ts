import type { RouterContext } from "../../types.ts";
import { sendList, sendText } from "../../wa/client.ts";
import {
  listWalletEarnActions,
  type WalletEarnAction,
} from "../../rpc/wallet.ts";
import { buildWaLink } from "../../utils/share.ts";
import { resendWalletMenu } from "./home.ts";
import { setState } from "../../state/store.ts";
import { logWalletAdjust } from "../../observe/log.ts";

const STATE_KEY = "wallet_earn";

type EarnState = { key: string; data?: { actions: WalletEarnAction[] } };

export async function showWalletEarn(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const actions = await listWalletEarnActions(
      ctx.supabase,
      ctx.profileId,
      10,
    );
    if (!actions.length) {
      await sendText(ctx.from, "No earn actions available right now.");
      await resendWalletMenu(ctx);
      return true;
    }
    const rows = actions.slice(0, 10).map((action) => ({
      id: action.id,
      title: action.title ?? "Earn tokens",
      description: earnDescription(action),
    }));
    await setState(ctx.supabase, ctx.profileId, {
      key: STATE_KEY,
      data: { actions },
    });
    await sendList(ctx.from, {
      title: "Earn Tokens",
      body: "Pick an action to see details.",
      sectionTitle: "Actions",
      rows,
    });
  } catch (error) {
    console.error("wallet.earn_fail", error);
    await sendText(ctx.from, "Couldn't load earn actions. Try again later.");
    await resendWalletMenu(ctx);
  }
  return true;
}

export async function handleWalletEarnSelection(
  ctx: RouterContext,
  state: EarnState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== STATE_KEY) return false;
  const actions = state.data?.actions ?? [];
  const match = actions.find((action) => action.id === id);
  if (!match) {
    await sendText(ctx.from, "Action not found.");
    await resendWalletMenu(ctx);
    return true;
  }
  const lines: string[] = [match.title ?? "Earn tokens"];
  if (match.description) lines.push(match.description);
  if (typeof match.reward_tokens === "number") {
    lines.push(`Reward: ${match.reward_tokens} tokens`);
  }
  if (match.referral_code) {
    const shareText = match.share_text ??
      `Join easyMO with referral ${match.referral_code}`;
    const link = buildWaLink(`${shareText} (code ${match.referral_code})`);
    if (link) {
      lines.push(`Share link: ${link}`);
    }
  }
  await sendText(ctx.from, lines.join("\n"));
  await logWalletAdjust({
    actor: ctx.from,
    action: "earn_select",
    reward: match.reward_tokens ?? 0,
  });
  await resendWalletMenu(ctx);
  return true;
}

function earnDescription(action: WalletEarnAction): string {
  const parts: string[] = [];
  if (action.description) parts.push(action.description);
  if (typeof action.reward_tokens === "number") {
    parts.push(`${action.reward_tokens} tokens`);
  }
  return parts.join(" • ");
}
