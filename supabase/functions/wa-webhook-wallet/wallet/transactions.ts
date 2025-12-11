import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendListMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import {
  listWalletTransactions,
  type WalletTransaction,
} from "../../_shared/wa-webhook-shared/rpc/wallet.ts";
import { fmtCurrency, timeAgo } from "../../_shared/wa-webhook-shared/utils/text.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import {
  WALLET_STATE_TRANSACTIONS,
  walletBackRow,
  walletRefreshRow,
} from "./home.ts";
import { logWalletAdjust } from "../../_shared/wa-webhook-shared/observe/log.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export async function showWalletTransactions(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const rows = await listWalletTransactions(ctx.supabase, ctx.profileId, 5);
    await setState(ctx.supabase, ctx.profileId, {
      key: WALLET_STATE_TRANSACTIONS,
      data: {},
    });
    const navRows = buildWalletNavRows(IDS.WALLET_TRANSACTIONS);
    if (!rows.length) {
      await sendListMessage(
        ctx,
        {
          title: "📜 Recent transactions",
          body: "No wallet activity yet.",
          sectionTitle: "Transactions",
          rows: navRows,
          buttonText: "Open",
        },
        { emoji: "📜" },
      );
      return true;
    }
    const rendered = rows.map((row, index) => buildTransactionRow(row, index));
    await sendListMessage(
      ctx,
      {
        title: "📜 Recent transactions",
        body: "Tap a transaction to refresh the list.",
        sectionTitle: "Transactions",
        rows: [...rendered, ...navRows].slice(0, 10),
        buttonText: "Open",
      },
      { emoji: "📜" },
    );
    await logWalletAdjust({ actor: ctx.from, count: rows.length });
  } catch (error) {
    console.error("wallet.tx_fail", error);
    await setState(ctx.supabase, ctx.profileId, {
      key: WALLET_STATE_TRANSACTIONS,
      data: {},
    });
    await sendListMessage(
      ctx,
      {
        title: "📜 Recent transactions",
        body: "⚠️ Couldn't load transactions. Try again later.",
        sectionTitle: "Transactions",
        rows: buildWalletNavRows(IDS.WALLET_TRANSACTIONS),
        buttonText: "Open",
      },
      { emoji: "📜" },
    );
  }
  return true;
}

function buildTransactionRow(
  tx: WalletTransaction,
  index: number,
): { id: string; title: string; description?: string } {
  let amount: string | null = null;
  if (typeof tx.amount_minor === "number") {
    if (tx.currency === "TOK") {
      amount = `${tx.amount_minor} tokens`;
    } else {
      amount = fmtCurrency(tx.amount_minor, tx.currency ?? "RWF");
    }
  }
  const sign = tx.direction === "debit"
    ? "-"
    : tx.direction === "credit"
    ? "+"
    : "";
  const when = tx.occurred_at ? timeAgo(tx.occurred_at) : null;
  const title = amount
    ? `${sign}${amount}`
    : tx.description ?? `Transaction ${index + 1}`;
  const details: string[] = [];
  if (tx.description && tx.description !== title) details.push(tx.description);
  if (when) details.push(when);
  if (!details.length) details.push("Wallet activity");
  return {
    id: `wallet_tx::${tx.id ?? index}`,
    title,
    description: details.length ? details.join(" • ") : undefined,
  };
}

function buildWalletNavRows(refreshId: string) {
  return [
    walletRefreshRow(refreshId, "🔁 Refresh list"),
    walletBackRow(),
  ];
}
