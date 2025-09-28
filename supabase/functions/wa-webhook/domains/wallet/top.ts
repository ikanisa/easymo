import type { RouterContext } from "../../types.ts";
import { sendButtonsMessage, sendListMessage } from "../../utils/reply.ts";
import {
  listWalletTopPromoters,
  type WalletPromoter,
} from "../../rpc/wallet.ts";
import { setState } from "../../state/store.ts";
import { walletBackRow, walletRefreshRow } from "./home.ts";
import { maskPhone } from "../../flows/support.ts";
import { logWalletAdjust } from "../../observe/log.ts";
import { IDS } from "../../wa/ids.ts";

export async function showWalletTop(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const top = await listWalletTopPromoters(ctx.supabase, 10);
    await setState(ctx.supabase, ctx.profileId, {
      key: "wallet_top",
      data: { count: top.length },
    });
    if (!top.length) {
      await sendButtonsMessage(
        ctx,
        "No promoter stats yet.",
        [walletBackRow()],
      );
      return true;
    }

    const normalizedSelf = ctx.from.startsWith("+") ? ctx.from : `+${ctx.from}`;
    const alreadyIncluded = top.some((row) =>
      row.whatsapp &&
      normalizeMsisdn(row.whatsapp) === normalizeMsisdn(normalizedSelf)
    );

    const rankedRows: Array<
      { id: string; title: string; description: string }
    > = [];
    top.slice(0, 9).forEach((entry, index) => {
      rankedRows.push(buildTopRow(index, entry));
    });

    if (!alreadyIncluded) {
      rankedRows.push(buildTopRow(rankedRows.length, {
        display_name: "You",
        whatsapp: normalizedSelf,
        tokens: undefined,
      }));
    }

    const limited = rankedRows.slice(0, 9);
    limited.push(walletBackRow());

    await sendListMessage(
      ctx,
      {
        title: "🏅 Top promoters",
        body: "Rankings update automatically when tokens change.",
        sectionTitle: "Promoters",
        buttonText: "View",
        rows: limited,
      },
      { emoji: "🏅" },
    );
    await logWalletAdjust({
      actor: ctx.from,
      action: "top_promoters",
      count: limited.length,
    });
  } catch (error) {
    console.error("wallet.top_fail", error);
    await sendButtonsMessage(ctx, "⚠️ Couldn't load promoter stats.", [
      { id: IDS.WALLET_TOP, title: "Done" },
    ]);
  }
  return true;
}

function buildTopRow(
  index: number,
  promoter: WalletPromoter,
): { id: string; title: string; description: string } {
  const rank = index + 1;
  const name = promoter.display_name ?? maskPhone(promoter.whatsapp ?? "");
  const tokens = typeof promoter.tokens === "number"
    ? `${promoter.tokens} tokens`
    : "No tokens yet";
  const phone = promoter.whatsapp ? maskPhone(promoter.whatsapp) : "";
  const description = phone ? `${tokens} • ${phone}` : tokens;
  const title = `#${rank} ${name}`.slice(0, 24);
  return {
    id: `wallet_top::${rank}`,
    title,
    description,
  };
}

function normalizeMsisdn(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("07")) return `+250${trimmed.slice(1)}`;
  if (trimmed.startsWith("250")) return `+${trimmed}`;
  return trimmed;
}
