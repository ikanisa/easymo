/**
 * JSDoc Documentation Standards
 * 
 * This file serves as a reference for documenting code in the EasyMO project.
 * All public functions, classes, and modules should follow these standards.
 */

/**
 * @module messaging/client
 * @description WhatsApp messaging client for sending messages to users.
 * 
 * @example
 * ```typescript
 * import { sendText } from './client.ts';
 * await sendText(ctx, "Hello, world!");
 * ```
 */

/**
 * Sends a text message to a WhatsApp user.
 * 
 * @param {RouterContext} ctx - The router context containing user information
 * @param {string} text - The text content to send (max 4096 characters)
 * @param {SendOptions} [options] - Optional send configuration
 * @param {boolean} [options.preview] - Enable link previews (default: true)
 * @param {string} [options.replyTo] - Message ID to reply to
 * 
 * @returns {Promise<SendResult>} Result object with success status and message ID
 * 
 * @throws {WhatsAppApiError} When the API call fails
 * @throws {ValidationError} When text exceeds maximum length
 * 
 * @example
 * ```typescript
 * const result = await sendText(ctx, "Hello!");
 * if (result.success) {
 *   console.log("Message sent:", result.messageId);
 * }
 * ```
 * 
 * @see {@link sendButtons} for sending interactive button messages
 * @since 2.0.0
 */
export async function sendTextExample(
  ctx: any,
  text: string,
  options?: { preview?: boolean; replyTo?: string }
): Promise<{ success: boolean; messageId?: string }> {
  return { success: true };
}

/**
 * Configuration options for the router context.
 * 
 * @interface RouterContext
 * @property {SupabaseClient} supabase - Supabase client instance
 * @property {string} from - User's WhatsApp phone number in E.164 format
 * @property {string} [profileId] - User's profile ID if authenticated
 * @property {Language} locale - User's preferred language
 * @property {string} requestId - Unique request identifier for tracing
 */
interface RouterContextExample {
  supabase: any;
  from: string;
  profileId?: string;
  locale: string;
  requestId: string;
}

/**
 * Result of a message send operation.
 * 
 * @typedef {Object} SendResult
 * @property {boolean} success - Whether the send was successful
 * @property {string} [messageId] - WhatsApp message ID if successful
 * @property {string} [error] - Error message if failed
 */
type SendResultExample = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export {};
