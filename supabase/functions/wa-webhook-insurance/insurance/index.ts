/**
 * Simplified Insurance - Just show contact info
 */

import { logStructuredEvent } from "../../_shared/observability.ts";
import { sendHomeMenu } from "../../_shared/wa-webhook-shared/flows/home.ts";
import { clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { getInsuranceContactMessage } from "./simple_flow.ts";

type InsuranceState = { key: string; data?: Record<string, unknown> };

/**
 * Start insurance flow - just send contact information
 */
export async function startInsurance(
  ctx: RouterContext,
  _state: InsuranceState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await logStructuredEvent("INSURANCE_CONTACT_SENT", { from: ctx.from });
  
  // Get the contact message
  const contactMessage = await getInsuranceContactMessage(ctx.supabase);
  
  // Send it to the user
  await sendText(ctx.from, contactMessage);
  
  // Clear any state
  await clearState(ctx.supabase, ctx.profileId);
  
  return true;
}

/**
 * Handle insurance list/button selections - redirect to contact or home
 */
export async function handleInsuranceListSelection(
  ctx: RouterContext,
  _state: InsuranceState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // For any insurance-related selection, just show contact info
  if (id === IDS.INSURANCE_SEND_CERTIFICATE || 
      id === IDS.INSURANCE_SEND_CARTE_JAUNE || 
      id === IDS.INSURANCE_CHAT_TEAM ||
      id === IDS.INSURANCE_SUBMIT ||
      id === IDS.INSURANCE_HELP ||
      id === IDS.MOTOR_INSURANCE_UPLOAD) {
    return await startInsurance(ctx, _state);
  }
  
  // Handle back to menu
  if (id === IDS.BACK_MENU || id === IDS.BACK_HOME) {
    await clearState(ctx.supabase, ctx.profileId);
    await sendHomeMenu(ctx);
    return true;
  }
  
  return false;
}

/**
 * Handle media - no longer supported, just show contact info
 */
export async function handleInsuranceMedia(
  ctx: RouterContext,
  _msg: Record<string, unknown>,
  state: InsuranceState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  await logStructuredEvent("INSURANCE_MEDIA_DEPRECATED", { from: ctx.from });
  
  // Instead of processing media, just send contact info
  return await startInsurance(ctx, state);
}
