/**
 * Insurance Message Utilities
 * 
 * Builds formatted messages for insurance service
 */

/**
 * Build the main insurance service message with contact links
 */
export function buildInsuranceMessage(contactLinks: string): string {
  return `🛡️ *Insurance Services*

Contact our insurance agents directly on WhatsApp:

${contactLinks}

Tap any link above to start chatting with an insurance agent.`;
}

