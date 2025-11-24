import type { ButtonSpec, RouterContext } from "../../types.ts";
import {
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { clearState, setState } from "../../state/store.ts";
import { fetchWalletSummary } from "../../rpc/wallet.ts";
import { fmtCurrency } from "../../utils/text.ts";
import { sendHomeMenu } from "../../flows/home.ts";

export const WALLET_STATE_HOME = "wallet_home";
export const WALLET_STATE_TRANSACTIONS = "wallet_transactions";

type WalletListRow = { id: string; title: string; description: string };

export async function startWallet(
  ctx: RouterContext,
  _state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: WALLET_STATE_HOME,
    data: {},
  });
  const summary = await buildWalletSummary(ctx) ??
    "Wallet summary unavailable right now.";
  await sendListMessage(
    ctx,
    {
      title: "💎 Wallet & Tokens",
      body: `Summary: ${summary}`,
      sectionTitle: "Wallet",
      buttonText: "View",
      rows: buildWalletHomeRows(),
    },
    { emoji: "💎" },
  );
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

  const isWalletState = state.key.startsWith("wallet_");
  const walletKeyword = /\b(wallet|tokens?)\b/.test(lower);
  const jobIntent = /\b(job|jobs|work|hiring|gig)\b/.test(lower);

  // Only take over when the user mentions wallet/tokens, otherwise
  // allow other flows (e.g., jobs) to handle the text.
  if (!isWalletState) {
    if (!walletKeyword) return false;
  } else {
    // In wallet state: react only to wallet-related commands/keywords,
    // otherwise release control so other domains can handle.
    const walletCommands = /\b(menu|back|wallet|token|tokens|balance|earn|redeem|transfer|transactions?|history|top)\b/;
    if (!walletCommands.test(lower)) {
      // If the user typed a clear jobs intent, let jobs handle it.
      if (jobIntent) return false;
      // For unrelated chatter, fall back to home menu instead of looping wallet.
      await clearState(ctx.supabase, ctx.profileId);
      return false;
    }
  }

  if (lower === "home") {
    await clearState(ctx.supabase, ctx.profileId);
    await sendHomeMenu(ctx);
    return true;
  }
  if (isWalletState) {
    if (lower === "menu" || lower === "back") {
      await startWallet(ctx, state);
      return true;
    }
  }
  await startWallet(ctx, state);
  return true;
}

export async function resendWalletMenu(ctx: RouterContext): Promise<void> {
  await startWallet(ctx, { key: WALLET_STATE_HOME });
}

async function buildWalletSummary(ctx: RouterContext): Promise<string | null> {
  try {
    const summary = await fetchWalletSummary(ctx.supabase, ctx.profileId!);
    if (!summary) return null;
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
      return parts.join(" • ");
    }
    return "Wallet overview not available.";
  } catch (error) {
    console.error("wallet.summary_fail", error);
    return null;
  }
}

export function walletActions(): ButtonSpec[] {
  return [
    { id: IDS.WALLET_EARN, title: "🏆 Share link" },
  ];
}

export function walletMenuButtons(): ButtonSpec[] {
  return [{ id: IDS.WALLET, title: "💎 Wallet" }];
}

export function walletBackRow(): WalletListRow {
  return {
    id: IDS.BACK_MENU,
    title: "← Back",
    description: "Return to the previous menu.",
  };
}

export function walletRefreshRow(id: string, title: string): WalletListRow {
  return {
    id,
    title,
    description: "Reload this list.",
  };
}

function buildWalletHomeRows(): WalletListRow[] {
  return [
    {
      id: IDS.WALLET_EARN,
      title: "Earn tokens",
      description: "Share invites to earn rewards.",
    },
    {
      id: IDS.WALLET_TRANSFER,
      title: "Transfer tokens",
      description: "Send tokens to a friend.",
    },
    {
      id: IDS.WALLET_TRANSACTIONS,
      title: "Transactions",
      description: "See wallet and token history.",
    },
    {
      id: IDS.WALLET_REDEEM,
      title: "Redeem",
      description: "Swap tokens for available rewards.",
    },
    {
      id: IDS.WALLET_TOP,
      title: "Top promoters",
      description: "View the referral leaderboard.",
    },
    walletBackRow(),
  ];
}
