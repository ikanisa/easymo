/**
 * Payload Utilities
 * 
 * Utilities for extracting data from WhatsApp webhook payloads
 */

/**
 * Extract phone number from WhatsApp webhook payload
 */
export function extractPhoneFromPayload(payload: unknown): string | null {
  try {
    const p = payload as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from?: string }> } }> }> };
    const messages = p?.entry?.[0]?.changes?.[0]?.value?.messages;
    if (Array.isArray(messages) && messages.length > 0) {
      return messages[0]?.from ?? null;
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

