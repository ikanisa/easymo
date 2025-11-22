/**
 * Message Formatter Utilities
 * 
 * Provides standardized formatting for AI agent chat messages including:
 * - Emoji-numbered lists (1️⃣, 2️⃣, 3️⃣)
 * - Action buttons
 * - User selection parsing
 * - Fallback flow detection
 */

import type { AgentContext } from "./agent_context.ts";

/**
 * Emoji numbers for list formatting
 */
const EMOJI_NUMBERS = [
  "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣",
  "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"
];

/**
 * Action button definition
 */
export interface ActionButton {
  id: string;
  title: string;
  emoji?: string;
}

/**
 * List option definition
 */
export interface ListOption {
  id: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Formatted message with action buttons
 */
export interface FormattedMessage {
  text: string;
  buttons: ActionButton[];
  optionsCount?: number;
}

/**
 * Format options as emoji-numbered list
 * 
 * @param options - Array of options to format
 * @param maxOptions - Maximum options to show (default: 10)
 * @returns Formatted string with emoji numbers
 * 
 * @example
 * ```typescript
 * const options = [
 *   { id: "1", title: "Restaurant A", description: "Italian cuisine" },
 *   { id: "2", title: "Restaurant B", description: "Japanese sushi" }
 * ];
 * const formatted = formatEmojiList(options);
 * // Returns:
 * // "1️⃣ Restaurant A\n   Italian cuisine\n\n2️⃣ Restaurant B\n   Japanese sushi"
 * ```
 */
export function formatEmojiList(
  options: ListOption[],
  maxOptions = 10
): string {
  const limitedOptions = options.slice(0, Math.min(maxOptions, EMOJI_NUMBERS.length));
  
  return limitedOptions.map((option, index) => {
    const emoji = EMOJI_NUMBERS[index];
    const title = option.title;
    const description = option.description ? `\n   ${option.description}` : "";
    
    return `${emoji} ${title}${description}`;
  }).join("\n\n");
}

/**
 * Parse user's emoji selection from message
 * Supports multiple formats:
 * - Numbers: "1", "2", "3"
 * - Emojis: "1️⃣", "2️⃣", "3️⃣"
 * - Text: "one", "two", "three", "first", "second"
 * - Phrases: "option 1", "number 2", "the first one"
 * 
 * @param userMessage - User's message text
 * @param optionCount - Total number of options presented
 * @returns Selected option index (1-based) or null if invalid
 * 
 * @example
 * ```typescript
 * parseEmojiSelection("1", 5) // Returns 1
 * parseEmojiSelection("2️⃣", 5) // Returns 2
 * parseEmojiSelection("the second one", 5) // Returns 2
 * parseEmojiSelection("option 3", 5) // Returns 3
 * parseEmojiSelection("invalid", 5) // Returns null
 * ```
 */
export function parseEmojiSelection(
  userMessage: string,
  optionCount: number
): number | null {
  const message = userMessage.trim().toLowerCase();
  
  // Check for emoji numbers (1️⃣, 2️⃣, etc.)
  for (let i = 0; i < Math.min(optionCount, EMOJI_NUMBERS.length); i++) {
    if (message.includes(EMOJI_NUMBERS[i])) {
      return i + 1;
    }
  }
  
  // Check for plain numbers (1, 2, 3, etc.)
  const numberMatch = message.match(/\b(\d+)\b/);
  if (numberMatch) {
    const num = parseInt(numberMatch[1], 10);
    if (num >= 1 && num <= optionCount) {
      return num;
    }
  }
  
  // Check for text numbers
  const textNumbers: Record<string, number> = {
    "one": 1, "first": 1, "1st": 1,
    "two": 2, "second": 2, "2nd": 2,
    "three": 3, "third": 3, "3rd": 3,
    "four": 4, "fourth": 4, "4th": 4,
    "five": 5, "fifth": 5, "5th": 5,
    "six": 6, "sixth": 6, "6th": 6,
    "seven": 7, "seventh": 7, "7th": 7,
    "eight": 8, "eighth": 8, "8th": 8,
    "nine": 9, "ninth": 9, "9th": 9,
    "ten": 10, "tenth": 10, "10th": 10
  };
  
  for (const [text, num] of Object.entries(textNumbers)) {
    if (message.includes(text) && num <= optionCount) {
      return num;
    }
  }
  
  return null;
}

/**
 * Format message with action buttons
 * 
 * @param message - Main message text
 * @param buttons - Array of action buttons
 * @returns Formatted message object
 * 
 * @example
 * ```typescript
 * const formatted = formatMessageWithButtons(
 *   "Select an action:",
 *   [
 *     { id: "view_menu", title: "📋 View Menu" },
 *     { id: "back_home", title: "🏠 Home" }
 *   ]
 * );
 * ```
 */
export function formatMessageWithButtons(
  message: string,
  buttons: ActionButton[]
): FormattedMessage {
  return {
    text: message,
    buttons: buttons.slice(0, 3), // WhatsApp limit: 3 buttons
  };
}

/**
 * Detect if message should trigger fallback to WhatsApp flow
 * 
 * @param context - Agent context
 * @param agentType - Type of agent
 * @returns True if should use fallback flow
 * 
 * Fallback scenarios:
 * 1. User explicitly requests menu/list
 * 2. Complex multi-step forms (e.g., insurance)
 * 3. User hasn't engaged with chat after 3 attempts
 * 4. Feature flag override
 */
export function shouldUseFallbackFlow(
  context: AgentContext,
  agentType: string
): boolean {
  const message = context.currentMessage.toLowerCase();
  
  // 1. User explicitly requests flow
  if (message.includes("menu") || 
      message.includes("list") || 
      message.includes("show options") ||
      message.includes("button")) {
    return true;
  }
  
  // 2. Complex multi-step forms
  if (agentType === "insurance" && 
      context.sessionData?.stage === "vehicle_details") {
    return true;
  }
  
  // 3. User hasn't engaged with chat after 3 attempts
  const chatAttempts = context.sessionData?.chat_attempts ?? 0;
  const chatEngaged = context.sessionData?.chat_engaged ?? false;
  if (chatAttempts >= 3 && !chatEngaged) {
    return true;
  }
  
  // 4. Feature flag override
  if (context.sessionData?.force_flow_mode) {
    return true;
  }
  
  return false;
}

/**
 * Create a formatted list message with emoji numbers and action buttons
 * 
 * @param header - Header text before the list
 * @param options - List options to display
 * @param footer - Footer text after the list (optional)
 * @param buttons - Action buttons to include (optional)
 * @returns Complete formatted message
 * 
 * @example
 * ```typescript
 * const message = createListMessage(
 *   "🏠 I found 3 properties:",
 *   [
 *     { id: "1", title: "2-bedroom apartment", description: "150,000 RWF/month" },
 *     { id: "2", title: "Studio in Remera", description: "80,000 RWF/month" }
 *   ],
 *   "Reply with the number to see details!",
 *   [{ id: "back_home", title: "🏠 Home" }]
 * );
 * ```
 */
export function createListMessage(
  header: string,
  options: ListOption[],
  footer?: string,
  buttons?: ActionButton[]
): FormattedMessage {
  const listText = formatEmojiList(options);
  const parts = [header, listText];
  
  if (footer) {
    parts.push(footer);
  }
  
  const text = parts.join("\n\n");
  
  return {
    text,
    buttons: buttons || [],
    optionsCount: options.length
  };
}

/**
 * Validate action button configuration
 * Ensures buttons meet WhatsApp requirements
 * 
 * @param buttons - Buttons to validate
 * @returns Validated and truncated buttons
 */
export function validateActionButtons(buttons: ActionButton[]): ActionButton[] {
  // WhatsApp limits: max 3 buttons, max 20 chars per title
  return buttons.slice(0, 3).map(btn => ({
    ...btn,
    title: btn.title.slice(0, 20)
  }));
}

/**
 * Extract option metadata from formatted list
 * Useful for tracking what options were presented
 * 
 * @param options - Original options
 * @returns Metadata object for session storage
 */
export function extractOptionsMetadata(options: ListOption[]): Record<string, unknown> {
  return {
    count: options.length,
    ids: options.map(o => o.id),
    titles: options.map(o => o.title),
    timestamp: new Date().toISOString()
  };
}

/**
 * Check if user message is a valid selection from previous options
 * 
 * @param userMessage - User's message
 * @param previousOptionsCount - Number of options from last message
 * @returns True if message appears to be a selection
 */
export function isSelectionMessage(
  userMessage: string,
  previousOptionsCount: number
): boolean {
  if (!previousOptionsCount || previousOptionsCount === 0) {
    return false;
  }
  
  const selection = parseEmojiSelection(userMessage, previousOptionsCount);
  return selection !== null;
}

/**
 * Generate help text for emoji selection
 * 
 * @param optionCount - Number of options available
 * @returns Help text explaining how to select
 */
export function getSelectionHelpText(optionCount: number): string {
  if (optionCount <= 3) {
    return `Reply with 1, 2, or 3 to select an option.`;
  } else if (optionCount <= 5) {
    return `Reply with a number (1-${optionCount}) to select an option.`;
  } else {
    return `Reply with a number (1-${optionCount}) to select, or describe what you're looking for.`;
  }
}
