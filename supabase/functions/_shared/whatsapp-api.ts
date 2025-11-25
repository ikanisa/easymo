/**
 * WhatsApp API wrapper
 * Provides a unified interface for sending WhatsApp messages
 */

import { sendText, sendList, sendButtons } from "./wa-webhook-shared/wa/client.ts";

export interface WhatsAppMessageOptions {
  text?: string;
  interactiveList?: any;
  interactiveButtons?: any;
}

/**
 * Send a WhatsApp message (text, list, or buttons)
 */
export async function sendWhatsAppMessage(
  to: string,
  options: WhatsAppMessageOptions
): Promise<void> {
  if (options.interactiveList) {
    await sendList(to, options.interactiveList);
  } else if (options.interactiveButtons) {
    await sendButtons(to, options.interactiveButtons);
  } else if (options.text) {
    await sendText(to, options.text);
  }
}
