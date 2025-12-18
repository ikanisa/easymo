/**
 * Message Extraction Utilities
 * 
 * Shared utilities for extracting messages from WhatsApp webhook payloads
 */

import type { WhatsAppWebhookPayload, WhatsAppMessage } from "../../_shared/wa-webhook-shared/types.ts";

/**
 * Extract the first message from a WhatsApp webhook payload
 */
export function getFirstMessage(payload: WhatsAppWebhookPayload): WhatsAppMessage | undefined {
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const messages = change?.value?.messages;
      if (Array.isArray(messages) && messages.length > 0) {
        return messages[0] as WhatsAppMessage;
      }
    }
  }
  return undefined;
}

