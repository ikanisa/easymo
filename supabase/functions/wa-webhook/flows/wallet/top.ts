import type { RouterContext } from "../../types.ts";
import { sendText } from "../../wa/client.ts";
import {
  listWalletTopPromoters,
  type WalletPromoter,
} from "../../rpc/wallet.ts";
import { resendWalletMenu } from "./home.ts";
import { maskPhone } from "../support.ts";
import { logWalletAdjust } from "../../observe/log.ts";

export async function showWalletTop(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const rows = await listWalletTopPromoters(ctx.supabase, 9);
    if (!rows.length) {
      await sendText(ctx.from, "No promoter stats yet.");
      await resendWalletMenu(ctx);
      return true;
    }
    const lines = rows.map((row, idx) => formatPromoter(idx, row));
    await sendText(ctx.from, lines.join("\n"));
    await logWalletAdjust({
      actor: ctx.from,
      action: "top_promoters",
      count: rows.length,
    });
  } catch (error) {
    console.error("wallet.top_fail", error);
    await sendText(ctx.from, "Couldn't load promoter stats.");
  }
  await resendWalletMenu(ctx);
  return true;
}

function formatPromoter(index: number, promoter: WalletPromoter): string {
  const rank = index + 1;
  const name = promoter.display_name ?? maskPhone(promoter.whatsapp ?? "");
  const tokens = typeof promoter.tokens === "number"
    ? `${promoter.tokens} tokens`
    : "";
  return `${rank}. ${name}${tokens ? ` — ${tokens}` : ""}`;
}
