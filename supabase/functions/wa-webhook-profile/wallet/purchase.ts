import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState, getState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendListMessage, sendButtonsMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export const PURCHASE_STATES = {
  AMOUNT: "wallet_purchase_amount",
  CONFIRM: "wallet_purchase_confirm",
  PENDING: "wallet_purchase_pending"
};

const TOKEN_PACKAGES = [
  { tokens: 1000, rwf: 500, id: "purchase_1000" },
  { tokens: 5000, rwf: 2500, id: "purchase_5000" },
  { tokens: 10000, rwf: 5000, id: "purchase_10000" },
  { tokens: 50000, rwf: 25000, id: "purchase_50000" },
  { tokens: 100000, rwf: 50000, id: "purchase_100000" }
];

export async function handleWalletPurchase(ctx: RouterContext): Promise<boolean> {
  await setState(ctx.supabase, ctx.profileId!, {
    key: PURCHASE_STATES.AMOUNT,
    data: {}
  });

  await logStructuredEvent("WALLET_PURCHASE_START", {
    userId: ctx.profileId,
    from: ctx.from
  });

  await sendListMessage(ctx, {
    title: "💰 Buy Tokens",
    body: "Select amount to purchase:\n\n1 token = 0.5 RWF",
    buttonText: "Select Amount",
    rows: [
      ...TOKEN_PACKAGES.map(pkg => ({
        id: pkg.id,
        title: `${pkg.tokens.toLocaleString()} tokens`,
        description: `${pkg.rwf.toLocaleString()} RWF`
      })),
      { id: "purchase_custom", title: "Custom Amount", description: "Enter your own amount" },
      { id: IDS.BACK_MENU, title: "← Back" }
    ]
  });

  return true;
}

export async function handlePurchasePackage(
  ctx: RouterContext,
  packageId: string
): Promise<boolean> {
  const pkg = TOKEN_PACKAGES.find(p => p.id === packageId);
  
  if (!pkg) {
    if (packageId === "purchase_custom") {
      await sendText(ctx.from,
        "💰 *Custom Token Purchase*\n\n" +
        "Enter the number of tokens you want to buy:\n\n" +
        "Minimum: 100 tokens (50 RWF)\n" +
        "Rate: 1 token = 0.5 RWF"
      );
      return true;
    }
    return false;
  }

  return await initiatePurchase(ctx, pkg.tokens, pkg.rwf);
}

export async function handlePurchaseAmount(
  ctx: RouterContext,
  amountStr: string
): Promise<boolean> {
  const amount = parseInt(amountStr.replace(/[^0-9]/g, ""));
  
  if (isNaN(amount) || amount < 100) {
    await sendText(ctx.from, "❌ Minimum purchase: 100 tokens (50 RWF)");
    return true;
  }

  const rwfAmount = amount * 0.5; // 1 token = 0.5 RWF

  return await initiatePurchase(ctx, amount, rwfAmount);
}

async function initiatePurchase(
  ctx: RouterContext,
  tokenAmount: number,
  rwfAmount: number
): Promise<boolean> {
  try {
    // Create purchase record
    const { data: purchase, error } = await ctx.supabase
      .from("wallet_purchases")
      .insert({
        user_id: ctx.profileId,
        user_wa_id: ctx.from,
        token_amount: tokenAmount,
        rwf_amount: rwfAmount,
        payment_method: "momo",
        status: "pending"
      })
      .select()
      .single();

    if (error || !purchase) {
      await logStructuredEvent("WALLET_PURCHASE_CREATE_ERROR", {
        userId: ctx.profileId,
        error: error?.message
      }, "error");
      
      await sendText(ctx.from, "❌ Error creating purchase. Please try again.");
      return false;
    }

    // TODO: Initiate MoMo payment
    // For now, send instructions
    await setState(ctx.supabase, ctx.profileId!, {
      key: PURCHASE_STATES.PENDING,
      data: { purchaseId: purchase.id, tokenAmount, rwfAmount }
    });

    await sendText(ctx.from,
      `📱 *Token Purchase Initiated*\n\n` +
      `Tokens: ${tokenAmount.toLocaleString()}\n` +
      `Amount: ${rwfAmount.toLocaleString()} RWF\n` +
      `Reference: ${purchase.id.slice(0, 8)}\n\n` +
      `💳 *Payment Instructions:*\n` +
      `1. Dial *182*7*1#\n` +
      `2. Select "Pay Bill"\n` +
      `3. Enter merchant code: [MERCHANT_CODE]\n` +
      `4. Enter amount: ${rwfAmount}\n` +
      `5. Enter reference: ${purchase.id.slice(0, 8)}\n\n` +
      `You'll receive confirmation once payment is received.`
    );

    await logStructuredEvent("WALLET_PURCHASE_INITIATED", {
      userId: ctx.profileId,
      purchaseId: purchase.id,
      tokenAmount,
      rwfAmount
    });

    return true;
  } catch (error) {
    await logStructuredEvent("WALLET_PURCHASE_ERROR", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error)
    }, "error");

    await sendText(ctx.from, "❌ Unexpected error. Please try again later.");
    return false;
  }
}

// Called by payment webhook to confirm purchase
export async function confirmPurchase(
  supabase: any,
  purchaseId: string,
  momoTransactionId: string,
  notifier?: (to: string, body: string) => Promise<void>
): Promise<boolean> {
  try {
    const { data: purchase } = await supabase
      .from("wallet_purchases")
      .select("*")
      .eq("id", purchaseId)
      .single();

    if (!purchase || purchase.status !== "pending") {
      return false;
    }

    // Credit tokens using RPC
    const { error: creditError } = await supabase.rpc("wallet_credit_tokens", {
      p_user_id: purchase.user_id,
      p_amount: purchase.token_amount,
      p_reference_type: "purchase",
      p_reference_id: purchaseId,
      p_description: `Purchased ${purchase.token_amount} tokens`
    });

    if (creditError) {
      console.error("Token credit error:", creditError);
      return false;
    }

    // Update purchase status
    await supabase
      .from("wallet_purchases")
      .update({
        status: "completed",
        momo_transaction_id: momoTransactionId,
        completed_at: new Date().toISOString()
      })
      .eq("id", purchaseId);

    // Notify user
    const sendTextFn = notifier || (await import("../../_shared/wa-webhook-shared/wa/client.ts")).sendText;
    await sendTextFn(purchase.user_wa_id,
      `✅ *Purchase Complete!*\n\n` +
      `${purchase.token_amount.toLocaleString()} tokens added to your wallet.\n\n` +
      `Type 'wallet' to view your balance.`
    );

    await logStructuredEvent("WALLET_PURCHASE_COMPLETED", {
      userId: purchase.user_id,
      purchaseId,
      tokenAmount: purchase.token_amount
    });

    return true;
  } catch (error) {
    console.error("Purchase confirmation error:", error);
    return false;
  }
}
