import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendButtonsMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

/**
 * Wallet Handler
 * 
 * NOTE: Wallet functionality is handled by wa-webhook-wallet service
 * This handler provides information and redirects to the wallet service
 */

export async function showWalletInfo(ctx: RouterContext): Promise<boolean> {
  // Wallet is now handled by wa-webhook-wallet service
  // This is just a placeholder in case direct access is needed
  
  await sendButtonsMessage(
    ctx,
    "💎 *Wallet & Tokens*\n\n" +
    "The wallet feature has been moved to a dedicated service.\n\n" +
    "To access your wallet, send 'wallet' or 'tokens' in the main menu.",
    [
      { id: IDS.BACK_MENU, title: "← Back to Menu" },
    ]
  );
  
  return true;
}
