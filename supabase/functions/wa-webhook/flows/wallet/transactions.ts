import type { RouterContext } from "../../types.ts";
import { sendText } from "../../wa/client.ts";
import {
  listWalletTransactions,
  type WalletTransaction,
} from "../../rpc/wallet.ts";
import { fmtCurrency, timeAgo } from "../../utils/text.ts";
import { resendWalletMenu } from "./home.ts";
import { logWalletAdjust } from "../../observe/log.ts";

export async function showWalletTransactions(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const rows = await listWalletTransactions(ctx.supabase, ctx.profileId, 5);
    if (!rows.length) {
      await sendText(ctx.from, "No wallet transactions yet.");
      await resendWalletMenu(ctx);
      return true;
    }
    const lines = rows.map((row) => describeTransaction(row));
    await sendText(ctx.from, lines.join("\n"));
    await logWalletAdjust({ actor: ctx.from, count: rows.length });
  } catch (error) {
    console.error("wallet.tx_fail", error);
    await sendText(ctx.from, "Couldn't load transactions. Try again later.");
  }
  await resendWalletMenu(ctx);
  return true;
}

function describeTransaction(tx: WalletTransaction): string {
  const amount = typeof tx.amount_minor === "number"
    ? fmtCurrency(tx.amount_minor, tx.currency ?? "RWF")
    : "";
  const sign = tx.direction === "debit"
    ? "-"
    : tx.direction === "credit"
    ? "+"
    : "";
  const when = tx.occurred_at ? timeAgo(tx.occurred_at) : "";
  const parts = [sign && amount ? `${sign}${amount}` : amount];
  if (tx.description) parts.push(tx.description);
  if (when) parts.push(when);
  return parts.filter(Boolean).join(" • ");
}
