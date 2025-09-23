import type { RouterContext } from "../../types.ts";
import { sendButtons, sendText } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { clearState, setState } from "../../state/store.ts";
import { fetchWalletSummary } from "../../rpc/wallet.ts";
import { fmtCurrency } from "../../utils/text.ts";
import { sendHomeMenu } from "../home.ts";

export const WALLET_STATE_HOME = "wallet_home";

export async function startWallet(
  ctx: RouterContext,
  _state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: WALLET_STATE_HOME,
    data: {},
  });
  await sendWalletSummary(ctx);
  await sendButtons(ctx.from, "Wallet & Tokens", [
    { id: IDS.WALLET_EARN, title: "Earn" },
    { id: IDS.WALLET_TRANSACTIONS, title: "Transactions" },
    { id: IDS.WALLET_REDEEM, title: "Redeem" },
  ]);
  return true;
}

export async function handleWalletText(
  ctx: RouterContext,
  body: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const lower = body.trim().toLowerCase();
  if (!lower) return false;
  if (lower === "home") {
    await clearState(ctx.supabase, ctx.profileId);
    await sendHomeMenu(ctx);
    return true;
  }
  if (state.key.startsWith("wallet_")) {
    if (lower === "menu" || lower === "back") {
      await startWallet(ctx, state);
      return true;
    }
  }
  return false;
}

export async function resendWalletMenu(ctx: RouterContext): Promise<void> {
  await startWallet(ctx, { key: WALLET_STATE_HOME });
}

async function sendWalletSummary(ctx: RouterContext): Promise<void> {
  try {
    const summary = await fetchWalletSummary(ctx.supabase, ctx.profileId!);
    if (!summary) {
      await sendText(ctx.from, "Wallet balance unavailable right now.");
      return;
    }
    const parts: string[] = [];
    if (typeof summary.balance_minor === "number") {
      parts.push(
        `Balance: ${
          fmtCurrency(summary.balance_minor, summary.currency ?? "RWF")
        }`,
      );
    }
    if (typeof summary.tokens === "number") {
      parts.push(`Tokens: ${summary.tokens}`);
    }
    if (
      typeof summary.pending_minor === "number" && summary.pending_minor > 0
    ) {
      parts.push(
        `Pending: ${
          fmtCurrency(summary.pending_minor, summary.currency ?? "RWF")
        }`,
      );
    }
    if (parts.length) {
      await sendText(ctx.from, parts.join(" • "));
    }
  } catch (error) {
    console.error("wallet.summary_fail", error);
    await sendText(ctx.from, "Wallet balance unavailable right now.");
  }
}
