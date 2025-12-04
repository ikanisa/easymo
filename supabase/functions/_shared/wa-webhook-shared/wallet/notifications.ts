import { sendText } from "../wa/client.ts";
import { logStructuredEvent } from "../observe/log.ts";

/**
 * Notify user of token allocation
 */
export async function notifyTokenAllocation(
  phone: string,
  amount: number,
  reason: string,
  allocationId: string
) {
  try {
    await sendText(
      phone,
      `✅ You've received ${amount.toLocaleString()} tokens!\n\n` +
      `Reason: ${reason}\n\n` +
      `Use your tokens for discounts, rewards, and more!`
    );
    
    await logStructuredEvent("NOTIFICATION_SENT", {
      type: "allocation",
      phone,
      amount,
      allocationId
    });
  } catch (error) {
    console.error("Failed to send allocation notification", error);
  }
}

/**
 * Notify users of P2P transfer
 */
export async function notifyTokenTransfer(
  senderPhone: string,
  recipientPhone: string,
  amount: number,
  transferId: string
) {
  try {
    // Notify sender
    await sendText(
      senderPhone,
      `💸 Transfer sent!\n\n` +
      `Amount: ${amount.toLocaleString()} tokens\n` +
      `To: ${recipientPhone}`
    );
    
    // Notify recipient
    await sendText(
      recipientPhone,
      `💰 Tokens received!\n\n` +
      `Amount: ${amount.toLocaleString()} tokens\n` +
      `From: ${senderPhone}`
    );
    
    await logStructuredEvent("NOTIFICATION_SENT", {
      type: "transfer",
      senderPhone,
      recipientPhone,
      amount,
      transferId
    });
  } catch (error) {
    console.error("Failed to send transfer notification", error);
  }
}

/**
 * Notify user of redemption
 */
export async function notifyTokenRedemption(
  phone: string,
  itemName: string,
  cost: number,
  redemptionId: string
) {
  try {
    await sendText(
      phone,
      `🎁 Redemption successful!\n\n` +
      `Item: ${itemName}\n` +
      `Cost: ${cost.toLocaleString()} tokens\n\n` +
      `Your reward is being processed.`
    );
    
    await logStructuredEvent("NOTIFICATION_SENT", {
      type: "redemption",
      phone,
      itemName,
      cost,
      redemptionId
    });
  } catch (error) {
    console.error("Failed to send redemption notification", error);
  }
}

/**
 * Notify user of failed transaction
 */
export async function notifyTransactionFailed(
  phone: string,
  type: string,
  reason: string
) {
  try {
    await sendText(
      phone,
      `❌ Transaction failed\n\n` +
      `Type: ${type}\n` +
      `Reason: ${reason}\n\n` +
      `Please try again or contact support.`
    );
  } catch (error) {
    console.error("Failed to send failure notification", error);
  }
}
