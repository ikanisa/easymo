/**
 * AI Agent Chat Interface Utilities
 * 
 * Provides consistent, emoji-rich, button-enabled chat interfaces for all AI agents.
 * All agents MUST use natural language chat with:
 * - Emoji-numbered listings (1️⃣, 2️⃣, 3️⃣)
 * - Action buttons for quick responses
 * - Concise messages with emojis
 */

import type { RouterContext, ButtonSpec } from "../types.ts";
import { sendText } from "../wa/client.ts";
import { sendButtonsMessage } from "./reply.ts";

/**
 * Emoji numbers for numbered lists (1️⃣-9️⃣, 0️⃣)
 */
const EMOJI_NUMBERS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

/**
 * Format options/items as emoji-numbered list
 * 
 * @example
 * formatEmojiNumberedList([
 *   { text: "Pizza Roma - 5000 RWF", description: "Italian restaurant, 2km away" },
 *   { text: "Burger House - 3000 RWF", description: "Fast food, 1km away" }
 * ])
 * // Returns:
 * // "1️⃣ Pizza Roma - 5000 RWF\n   Italian restaurant, 2km away\n\n2️⃣ Burger House - 3000 RWF\n   Fast food, 1km away"
 */
export function formatEmojiNumberedList(
  items: Array<{ text: string; description?: string }>,
  options: {
    startFrom?: number;
    maxItems?: number;
    includeZero?: boolean;
  } = {}
): string {
  const { startFrom = 1, maxItems = 9, includeZero = false } = options;
  
  if (!items || items.length === 0) {
    return "";
  }

  const limitedItems = items.slice(0, maxItems);
  
  return limitedItems
    .map((item, index) => {
      const number = startFrom + index;
      const emoji = EMOJI_NUMBERS[number] || `${number}️⃣`;
      
      let line = `${emoji} ${item.text}`;
      if (item.description) {
        line += `\n   ${item.description}`;
      }
      
      return line;
    })
    .join('\n\n');
}

/**
 * Create action buttons for agent responses
 * 
 * @example
 * createAgentActionButtons([
 *   { id: 'select_1', title: 'Choose #1', emoji: '✅' },
 *   { id: 'back', title: 'Back', emoji: '◀️' }
 * ])
 */
export function createAgentActionButtons(
  actions: Array<{ id: string; title: string; emoji?: string }>,
  options: {
    includeHome?: boolean;
    maxButtons?: number;
  } = {}
): ButtonSpec[] {
  const { includeHome = true, maxButtons = 3 } = options;
  
  const buttons: ButtonSpec[] = actions.slice(0, maxButtons).map(action => ({
    id: action.id,
    title: action.emoji ? `${action.emoji} ${action.title}` : action.title
  }));
  
  // Home button is auto-added by sendButtonsMessage, so we don't add it here
  
  return buttons;
}

/**
 * Send agent message with emoji-numbered list and action buttons
 * 
 * @example
 * await sendAgentListResponse(ctx, {
 *   emoji: '🍕',
 *   message: 'Found 3 restaurants near you:',
 *   items: [
 *     { text: 'Pizza Roma - 5000 RWF', description: '2km away' },
 *     { text: 'Burger House - 3000 RWF', description: '1km away' },
 *     { text: 'Pasta Palace - 4000 RWF', description: '3km away' }
 *   ],
 *   actions: [
 *     { id: 'select_item', title: 'Select', emoji: '✅' },
 *     { id: 'search_again', title: 'Search Again', emoji: '🔍' }
 *   ]
 * });
 */
export async function sendAgentListResponse(
  ctx: RouterContext,
  config: {
    emoji?: string;
    message: string;
    items: Array<{ text: string; description?: string }>;
    actions: Array<{ id: string; title: string; emoji?: string }>;
    listOptions?: {
      startFrom?: number;
      maxItems?: number;
    };
  }
): Promise<void> {
  const { emoji, message, items, actions, listOptions } = config;
  
  // Build the full message with emoji-numbered list
  const numberedList = formatEmojiNumberedList(items, listOptions);
  const fullMessage = numberedList 
    ? `${message}\n\n${numberedList}`
    : message;
  
  // Create action buttons
  const buttons = createAgentActionButtons(actions);
  
  // Send message with buttons
  await sendButtonsMessage(ctx, fullMessage, buttons, { emoji });
}

/**
 * Send concise agent message with action buttons
 * 
 * @example
 * await sendAgentMessageWithActions(ctx, {
 *   emoji: '✅',
 *   message: 'Order placed successfully! Your driver will arrive in 10 minutes.',
 *   actions: [
 *     { id: 'track_order', title: 'Track Order', emoji: '📍' },
 *     { id: 'cancel', title: 'Cancel', emoji: '❌' }
 *   ]
 * });
 */
export async function sendAgentMessageWithActions(
  ctx: RouterContext,
  config: {
    emoji?: string;
    message: string;
    actions: Array<{ id: string; title: string; emoji?: string }>;
  }
): Promise<void> {
  const { emoji, message, actions } = config;
  
  const buttons = createAgentActionButtons(actions);
  await sendButtonsMessage(ctx, message, buttons, { emoji });
}

/**
 * Send simple agent text message with emoji
 * 
 * @example
 * await sendAgentMessage(ctx, '✅', 'Payment processed successfully!');
 */
export async function sendAgentMessage(
  ctx: RouterContext,
  emoji: string,
  message: string
): Promise<void> {
  const fullMessage = emoji ? `${emoji} ${message}` : message;
  await sendText(ctx.from, fullMessage);
}

/**
 * Format error message for agent responses
 */
export function formatAgentError(error: string, context?: string): string {
  const contextMsg = context ? ` (${context})` : '';
  return `❌ ${error}${contextMsg}`;
}

/**
 * Format success message for agent responses
 */
export function formatAgentSuccess(message: string): string {
  return `✅ ${message}`;
}

/**
 * Create quick reply instruction text
 * 
 * @example
 * createQuickReplyInstruction(['number to select', 'name to search'])
 * // Returns: "Reply with number to select or name to search"
 */
export function createQuickReplyInstruction(options: string[]): string {
  if (options.length === 0) return '';
  if (options.length === 1) return `Reply with ${options[0]}`;
  
  const last = options[options.length - 1];
  const rest = options.slice(0, -1);
  
  return `Reply with ${rest.join(', ')} or ${last}`;
}

/**
 * Parse emoji number from user input
 * Supports both emoji (1️⃣) and plain numbers (1)
 */
export function parseEmojiNumber(input: string): number | null {
  const trimmed = input.trim();
  
  // Check for emoji number
  const emojiIndex = EMOJI_NUMBERS.indexOf(trimmed);
  if (emojiIndex !== -1) {
    return emojiIndex;
  }
  
  // Check for plain number
  const plainNumber = parseInt(trimmed, 10);
  if (!isNaN(plainNumber) && plainNumber >= 0 && plainNumber <= 9) {
    return plainNumber;
  }
  
  return null;
}

/**
 * Agent response templates with emoji and action patterns
 */
export const AGENT_TEMPLATES = {
  searching: (itemType: string) => `🔍 Searching for ${itemType}...`,
  found: (count: number, itemType: string) => 
    count === 0 ? `No ${itemType} found` :
    count === 1 ? `Found 1 ${itemType}:` :
    `Found ${count} ${itemType}:`,
  notFound: (itemType: string, suggestion?: string) => {
    const base = `❌ No ${itemType} found.`;
    return suggestion ? `${base}\n\n💡 ${suggestion}` : base;
  },
  processing: (action: string) => `⏳ ${action}...`,
  success: (action: string) => `✅ ${action} successful!`,
  error: (action: string, reason?: string) => {
    const base = `❌ ${action} failed.`;
    return reason ? `${base} ${reason}` : base;
  },
  help: (instructions: string) => `💡 ${instructions}`,
  greeting: (name?: string) => 
    name ? `👋 Hi ${name}! How can I help you?` : '👋 Hi! How can I help you?',
  farewell: () => '👋 Thank you! Have a great day!',
  confirmation: (action: string) => `Are you sure you want to ${action}?`,
};
