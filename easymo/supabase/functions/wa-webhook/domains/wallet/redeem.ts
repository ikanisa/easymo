import type { RouterContext } from "../../types.ts";
import { sendButtonsMessage, sendListMessage } from "../../utils/reply.ts";
import {
  listWalletRedeemOptions,
  type WalletRedeemOption,
} from "../../rpc/wallet.ts";
import { walletBackRow, walletRefreshRow } from "./home.ts";
import { setState } from "../../state/store.ts";
import { logWalletAdjust } from "../../observe/log.ts";
import { IDS } from "../../wa/ids.ts";

const STATES = {
  LIST: "wallet_redeem",
  CONFIRM: "wallet_redeem_confirm",
} as const;

type RedeemState =
  | { key: typeof STATES.LIST; data?: { options: WalletRedeemOption[] } }
  | { key: typeof STATES.CONFIRM; data?: { option?: WalletRedeemOption } };

export async function showWalletRedeem(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const options = await listWalletRedeemOptions(ctx.supabase, ctx.profileId);
    const navRows = buildWalletNavRows(IDS.WALLET_REDEEM);
    if (!options.length) {
      await sendListMessage(
        ctx,
        {
          title: "🎁 Redeem tokens",
          body: "No redeem options available yet.",
          sectionTitle: "Rewards",
          rows: navRows,
          buttonText: "Open",
        },
        { emoji: "🎁" },
      );
      return true;
    }
    await setState(ctx.supabase, ctx.profileId, {
      key: STATES.LIST,
      data: { options },
    });
    const prompt = "Pick a reward.";
    await sendListMessage(
      ctx,
      {
        title: "🎁 Redeem tokens",
        body: prompt,
        sectionTitle: "Rewards",
        rows: [
          ...options.slice(0, 7).map((opt) => buildRedeemRow(opt)),
          ...navRows,
        ].slice(0, 10),
        buttonText: "View",
      },
      { emoji: "🎁" },
    );
  } catch (error) {
    console.error("wallet.redeem_fail", error);
    await sendListMessage(
      ctx,
      {
        title: "🎁 Redeem tokens",
        body: "⚠️ Couldn't load rewards. Try again later.",
        sectionTitle: "Rewards",
        rows: buildWalletNavRows(IDS.WALLET_REDEEM),
        buttonText: "Open",
      },
      { emoji: "🎁" },
    );
  }
  return true;
}

export async function handleWalletRedeemSelection(
  ctx: RouterContext,
  state: RedeemState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== STATES.LIST) return false;
  const options = state.data?.options ?? [];
  const match = options.find((opt) => opt.id === id);
  if (!match) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Reward not found.",
      [{ id: IDS.WALLET_REDEEM, title: "Done" }],
    );
    return true;
  }
  const lines: string[] = [match.title ?? "Reward"];
  if (match.description) lines.push(match.description);
  if (typeof match.cost_tokens === "number") {
    lines.push(`Cost: ${match.cost_tokens} tokens`);
  }
  if (match.instructions) lines.push(match.instructions);
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.CONFIRM,
    data: { option: match },
  });
  await sendButtonsMessage(
    ctx,
    lines.join("\n"),
    [
      { id: IDS.WALLET_REDEEM_CONFIRM, title: "Confirm" },
      { id: IDS.WALLET_REDEEM, title: "Cancel" },
    ],
  );
  await logWalletAdjust({
    actor: ctx.from,
    action: "redeem_view",
    cost: match.cost_tokens ?? 0,
  });
  return true;
}

export async function handleWalletRedeemConfirm(
  ctx: RouterContext,
  state: RedeemState,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== STATES.CONFIRM) return false;
  const option = state.data?.option;
  if (!option) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Reward details missing. Reloading list.",
      [{ id: IDS.WALLET_REDEEM, title: "Done" }],
    );
    return true;
  }
  await logWalletAdjust({
    actor: ctx.from,
    action: "redeem_confirm",
    cost: option.cost_tokens ?? 0,
  });
  const summary = [
    `✅ ${option.title ?? "Reward"} requested!`,
    "We'll notify you once it's processed.",
  ].join("\n\n");
  await sendButtonsMessage(
    ctx,
    summary,
    [{ id: IDS.WALLET_REDEEM, title: "Done" }],
  );
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.CONFIRM,
    data: { option },
  });
  return true;
}

function buildWalletNavRows(refreshId: string) {
  return [
    walletRefreshRow(refreshId, "🔁 Refresh list"),
    walletBackRow(),
  ];
}

function buildRedeemRow(opt: WalletRedeemOption) {
  const details: string[] = [];
  if (opt.description) details.push(opt.description);
  if (typeof opt.cost_tokens === "number") {
    details.push(`${opt.cost_tokens} tokens`);
  }
  if (!details.length) {
    details.push("Tap to view details.");
  }
  return {
    id: opt.id,
    title: opt.title ?? "Reward",
    description: details.join(" • "),
  };
}
