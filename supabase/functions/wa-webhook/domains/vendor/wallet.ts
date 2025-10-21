import type { RouterContext } from "../../types.ts";
import {
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { logWalletAdjust } from "../../observe/log.ts";
import { fmtCurrency, timeAgo } from "../../utils/text.ts";
import { setState } from "../../state/store.ts";

const TOK_SYMBOL = "TOK";

export const VENDOR_WALLET_STATE = {
  HOME: "vendor_wallet_home",
  COMMISSIONS: "vendor_wallet_commissions",
  HISTORY: "vendor_wallet_history",
  PENDING_TOPUPS: "vendor_wallet_topups",
} as const;

type WalletVendorSummary = {
  tokens: number | null;
  pending_commissions_tokens: number | null;
  pending_commissions_count: number | null;
  recent: Array<{
    id: string;
    amount: number | null;
    currency: string | null;
    direction: string | null;
    description: string | null;
    occurred_at: string | null;
  }> | null;
};

type VendorCommissionRow = {
  id: string;
  amount_tokens: number | null;
  status: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
  broker?: {
    display_name?: string | null;
    whatsapp_e164?: string | null;
  } | null;
};

function formatTokens(amount: number | null | undefined): string {
  const safe = typeof amount === "number" ? amount : 0;
  return `${safe} ${TOK_SYMBOL}`;
}

function commissionRowId(id: string): string {
  return `vendor_commission::${id}`;
}

export async function showVendorWalletHome(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const summary = await fetchVendorWalletSummary(ctx);
  await setState(ctx.supabase, ctx.profileId, {
    key: VENDOR_WALLET_STATE.HOME,
    data: { summary },
  });
  const tokens = formatTokens(summary?.tokens ?? 0);
  const pendingTokens = formatTokens(summary?.pending_commissions_tokens ?? 0);
  const pendingCount = summary?.pending_commissions_count ?? 0;
  const bodyLines = [
    `Balance: ${tokens}`,
    `Commissions due: ${pendingTokens} (${pendingCount})`,
  ];
  await sendListMessage(
    ctx,
    {
      title: "💼 Vendor wallet",
      body: bodyLines.join("\n"),
      sectionTitle: "Options",
      buttonText: "Open",
      rows: [
        {
          id: IDS.VENDOR_WALLET_PAY,
          title: "Pay commissions",
          description: pendingCount
            ? `${pendingCount} pending`
            : "No payments due",
        },
        {
          id: IDS.VENDOR_WALLET_TOPUP,
          title: "Top up via MoMo",
          description: "Add funds with mobile money.",
        },
        {
          id: IDS.VENDOR_WALLET_PENDING_TOPUPS,
          title: "Pending top-ups",
          description: "Track mobile money payments.",
        },
        {
          id: IDS.VENDOR_WALLET_HISTORY,
          title: "Recent transactions",
          description: "View wallet debits and credits.",
        },
        {
          id: IDS.VENDOR_WALLET_SUPPORT,
          title: "Need help?",
          description: "Notify the broker support team.",
        },
        { id: IDS.BACK_MENU, title: "← Back" },
      ],
    },
    { emoji: "💼" },
  );
  return true;
}

export async function showVendorWalletCommissions(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const rows = await fetchVendorCommissions(ctx);
    await setState(ctx.supabase, ctx.profileId, {
      key: VENDOR_WALLET_STATE.COMMISSIONS,
      data: { commissionCount: rows.length },
    });
    if (!rows.length) {
      await sendButtonsMessage(
        ctx,
        "✅ No unpaid commissions right now.",
        [{ id: IDS.VENDOR_WALLET, title: "Wallet" }],
      );
      return true;
    }
    const listRows = rows.slice(0, 8).map((row) => {
      const brokerName = row.broker?.display_name ??
        row.broker?.whatsapp_e164 ??
        "Broker";
      const amount = formatTokens(row.amount_tokens ?? 0);
      const when = row.created_at ? timeAgo(row.created_at) : null;
      const descriptionParts = [amount];
      if (when) descriptionParts.push(when);
      return {
        id: commissionRowId(row.id),
        title: `Pay ${brokerName}`,
        description: descriptionParts.join(" • "),
      };
    });
    listRows.push({
      id: IDS.VENDOR_WALLET_REFRESH,
      title: "🔁 Refresh",
      description: "Reload commission list.",
    });
    listRows.push({ id: IDS.VENDOR_WALLET, title: "← Wallet home" });
    await sendListMessage(
      ctx,
      {
        title: "💼 Commissions due",
        body: "Select a commission to pay.",
        sectionTitle: "Pending",
        buttonText: "Open",
        rows: listRows,
      },
      { emoji: "💼" },
    );
    return true;
  } catch (error) {
    console.error("vendor.wallet.commissions_fail", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Couldn’t load commissions. Try again soon.",
      [{ id: IDS.VENDOR_WALLET, title: "Wallet" }],
    );
    return true;
  }
}

export async function handleVendorCommissionSelection(
  ctx: RouterContext,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const commissionId = id.replace("vendor_commission::", "");
  try {
    const { data, error } = await ctx.supabase.rpc("wallet_commission_pay", {
      _commission_id: commissionId,
      _actor_vendor: ctx.profileId,
    });
    if (error) {
      console.error("vendor.wallet.pay_fail", error, { commissionId });
      await sendButtonsMessage(
        ctx,
        "⚠️ Payment failed. Please top up or try again shortly.",
        [
          { id: IDS.VENDOR_WALLET_TOPUP, title: "Top up" },
          { id: IDS.VENDOR_WALLET_PAY, title: "Back" },
        ],
      );
      return true;
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) {
      const reason = result?.message ?? "unknown";
      if (reason === "commission_not_due") {
        await sendButtonsMessage(
          ctx,
          "That commission is already cleared.",
          [{ id: IDS.VENDOR_WALLET_PAY, title: "Back" }],
        );
        return true;
      }
      if (reason === "commission_not_found" || reason === "not_owner") {
        await sendButtonsMessage(
          ctx,
          "Commission not available.",
          [{ id: IDS.VENDOR_WALLET_PAY, title: "Back" }],
        );
        return true;
      }
      if (reason === "wallet_transfer_invalid_amount" ||
        reason === "wallet_insufficient_tokens") {
        await sendButtonsMessage(
          ctx,
          "Not enough tokens. Please top up first.",
          [
            { id: IDS.VENDOR_WALLET_TOPUP, title: "Top up" },
            { id: IDS.VENDOR_WALLET_PAY, title: "Back" },
          ],
        );
        return true;
      }
      await sendButtonsMessage(
        ctx,
        "⚠️ Couldn’t complete the payment. Try again soon.",
        [{ id: IDS.VENDOR_WALLET_PAY, title: "Back" }],
      );
      return true;
    }
    await logWalletAdjust({
      actor: ctx.from,
      action: "vendor_commission_paid",
      commission_id: commissionId,
      balance: result.vendor_balance ?? null,
    });
    const balanceMsg = typeof result.vendor_balance === "number"
      ? `New balance: ${formatTokens(result.vendor_balance)}.`
      : "";
    await sendButtonsMessage(
      ctx,
      `✅ Commission paid.\n${balanceMsg}`.trim(),
      [{ id: IDS.VENDOR_WALLET, title: "Wallet" }],
    );
    return true;
  } catch (error) {
    console.error("vendor.wallet.pay_exception", error, { commissionId });
    await sendButtonsMessage(
      ctx,
      "⚠️ Payment failed. Please try again later.",
      [{ id: IDS.VENDOR_WALLET_PAY, title: "Back" }],
    );
    return true;
  }
}

export async function showVendorWalletTopup(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const ussdCode = Deno.env.get("VENDOR_MOMO_USSD_CODE") ?? "*182*8*1#";
  const refPrefix = Deno.env.get("VENDOR_MOMO_REFERENCE_PREFIX") ?? "VEN";
  const instructions = [
    "Top up your wallet via MoMo:",
    `1. Dial ${ussdCode}.`,
    "2. Choose Pay Bills.",
    "3. Enter your reference code:",
    `   ${refPrefix}-${ctx.profileId?.slice(0, 8)}`,
    "4. Enter the amount and confirm.",
    "",
    "Provide this vendor ID to support if needed:",
    `   ${ctx.profileId}`,
    "",
    "We’ll notify you as soon as the payment is received.",
  ].join("\n");
  await setState(ctx.supabase, ctx.profileId, {
    key: VENDOR_WALLET_STATE.HOME,
    data: {},
  });
  await sendButtonsMessage(
    ctx,
    instructions,
    [
      { id: IDS.VENDOR_WALLET_PENDING_TOPUPS, title: "Pending top-ups" },
      { id: IDS.VENDOR_WALLET_HISTORY, title: "History" },
      { id: IDS.VENDOR_WALLET, title: "Wallet" },
    ],
  );
  return true;
}

export async function showVendorWalletPendingTopups(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    await setState(ctx.supabase, ctx.profileId, {
      key: VENDOR_WALLET_STATE.PENDING_TOPUPS,
      data: {},
    });
    const { data, error } = await ctx.supabase
      .from("wallet_topups_momo")
      .select("id, amount_tokens, status, created_at, momo_reference")
      .eq("vendor_profile_id", ctx.profileId)
      .in("status", ["pending", "completed"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    if (!data?.length) {
      await sendButtonsMessage(
        ctx,
        "No MoMo top-ups recorded yet.",
        [{ id: IDS.VENDOR_WALLET_TOPUP, title: "Top up" }],
      );
      return true;
    }
    const rows = data.map((row, index) => {
      const amount = formatTokens(row.amount_tokens ?? 0);
      const status = row.status === "completed" ? "✅ completed" : "⏳ pending";
      const when = row.created_at ? timeAgo(row.created_at) : null;
      const descriptionParts = [status];
      if (row.momo_reference) {
        descriptionParts.push(`Ref: ${row.momo_reference}`);
      }
      if (when) descriptionParts.push(when);
      return {
        id: `vendor_topup::${row.id ?? index}`,
        title: amount,
        description: descriptionParts.join(" • "),
      };
    });
    rows.push({ id: IDS.VENDOR_WALLET_TOPUP, title: "← Top up" });
    await sendListMessage(
      ctx,
      {
        title: "📲 MoMo top-ups",
        body: "Latest mobile money top-ups.",
        sectionTitle: "Top-ups",
        buttonText: "View",
        rows,
      },
      { emoji: "📲" },
    );
    return true;
  } catch (error) {
    console.error("vendor.wallet.topups_fail", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Couldn't load top-ups.",
      [{ id: IDS.VENDOR_WALLET_TOPUP, title: "Top up" }],
    );
    return true;
  }
}

export async function showVendorWalletHistory(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const { data, error } = await ctx.supabase
      .from("wallet_transactions")
      .select("id, amount_minor, currency, direction, description, occurred_at")
      .eq("profile_id", ctx.profileId)
      .order("occurred_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    if (!data?.length) {
      await sendButtonsMessage(
        ctx,
        "No wallet history yet.",
        [{ id: IDS.VENDOR_WALLET, title: "Wallet" }],
      );
      return true;
    }
    const rows = data.map((tx, index) => {
      const symbol = tx.direction === "credit" ? "+" : "-";
      const amount = tx.currency === "TOK"
        ? `${symbol}${formatTokens(tx.amount_minor ?? 0)}`
        : `${symbol}${fmtCurrency(tx.amount_minor ?? 0, tx.currency ?? "RWF")}`;
      const desc = tx.description ?? "Wallet activity";
      const when = tx.occurred_at ? timeAgo(tx.occurred_at) : null;
      return {
        id: `vendor_history::${tx.id ?? index}`,
        title: amount,
        description: when ? `${desc} • ${when}` : desc,
      };
    });
    rows.push({ id: IDS.VENDOR_WALLET, title: "← Wallet home" });
    await sendListMessage(
      ctx,
      {
        title: "📜 Wallet history",
        body: "Recent wallet debits and credits.",
        sectionTitle: "Transactions",
        buttonText: "View",
        rows,
      },
      { emoji: "📜" },
    );
    return true;
  } catch (error) {
    console.error("vendor.wallet.history_fail", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Couldn’t load history.",
      [{ id: IDS.VENDOR_WALLET, title: "Wallet" }],
    );
    return true;
  }
}

export async function sendVendorWalletSupport(
  ctx: RouterContext,
): Promise<boolean> {
  const supportNumber = Deno.env.get("VENDOR_SUPPORT_WHATSAPP") ??
    "+250780000000";
  const message = [
    "Need help with payments?",
    `Contact broker support: ${supportNumber}`,
  ].join("\n");
  await sendButtonsMessage(
    ctx,
    message,
    [{ id: IDS.VENDOR_WALLET, title: "Wallet" }],
  );
  return true;
}

async function fetchVendorWalletSummary(
  ctx: RouterContext,
): Promise<WalletVendorSummary | null> {
  try {
    const { data, error } = await ctx.supabase.rpc("wallet_vendor_summary", {
      _vendor_id: ctx.profileId,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row as WalletVendorSummary ?? null;
  } catch (error) {
    console.error("vendor.wallet.summary_fail", error);
    return null;
  }
}

async function fetchVendorCommissions(
  ctx: RouterContext,
): Promise<VendorCommissionRow[]> {
  const { data, error } = await ctx.supabase
    .from("vendor_commissions")
    .select(
      "id, amount_tokens, status, created_at, metadata, broker:profiles!vendor_commissions_broker_profile_id_fkey(display_name, whatsapp_e164)",
    )
    .eq("vendor_profile_id", ctx.profileId)
    .eq("status", "due")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VendorCommissionRow[];
}
