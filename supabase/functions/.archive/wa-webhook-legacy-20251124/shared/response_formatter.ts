/**
 * Response Formatting Utilities
 * 
 * Helper methods for formatting agent responses with emoji-numbered lists
 * and action buttons for chat-first architecture.
 */

import type { AgentContext } from "./agent_context.ts";
import type { AgentResponse, AgentType } from "./agent_orchestrator.ts";
import {
  createListMessage,
  validateActionButtons,
  type ListOption,
  type ActionButton,
} from "./message_formatter.ts";

/**
 * Format agent response with emoji-numbered lists and action buttons
 */
export function formatAgentResponse(
  response: AgentResponse,
  context: AgentContext,
): AgentResponse {
  // Check if response contains structured data that should be formatted as a list
  const listPattern = /(?:found|available|here are|options).*?:\s*\n/i;
  const hasListContent = listPattern.test(response.text);

  if (!hasListContent) {
    // No list formatting needed, return as-is with default buttons
    return {
      ...response,
      actionButtons: generateActionButtons(response.agentType),
    };
  }

  // Extract options from response text
  const options = extractOptionsFromText(response.text);

  if (options.length === 0) {
    // No options found, return with default buttons
    return {
      ...response,
      actionButtons: generateActionButtons(response.agentType),
    };
  }

  // Generate emoji-numbered list
  const formattedMessage = createListMessage(
    extractHeaderFromText(response.text),
    options,
    "Reply with the number to select!",
    generateActionButtons(response.agentType),
  );

  return {
    ...response,
    text: formattedMessage.text,
    optionsPresented: options,
    actionButtons: formattedMessage.buttons,
    requiresSelection: true,
  };
}

/**
 * Extract options from response text
 */
function extractOptionsFromText(text: string): ListOption[] {
  const options: ListOption[] = [];
  
  // Match patterns like:
  // 1. Title - Description
  // - Title (Description)
  // Title: Description
  const patterns = [
    /^\d+\.\s+(.+?)(?:\s*[-–—]\s*(.+?))?$/gm,  // 1. Title - Description
    /^[-•]\s+(.+?)(?:\s*\((.+?)\))?$/gm,        // - Title (Description)
    /^(.+?):\s*(.+?)$/gm,                        // Title: Description
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const title = match[1]?.trim();
      const description = match[2]?.trim();
      
      if (title && title.length > 0 && title.length < 100) {
        options.push({
          id: String(options.length + 1),
          title,
          description: description || undefined,
        });
      }
    }
    
    if (options.length > 0) break; // Found options with this pattern
  }

  // Limit to 10 options max
  return options.slice(0, 10);
}

/**
 * Extract header text before the list
 */
function extractHeaderFromText(text: string): string {
  const lines = text.split('\n');
  const firstLine = lines[0] || "Here are your options:";
  return firstLine.trim();
}

/**
 * Generate contextual action buttons based on agent type
 */
function generateActionButtons(agentType: AgentType): ActionButton[] {
  const commonButtons: ActionButton[] = [
    { id: "home", title: "🏠 Home" },
  ];

  const agentSpecificButtons: Record<AgentType, ActionButton[]> = {
    waiter: [{ id: "search_again", title: "🔍 Search Again" }],
    rides: [{ id: "schedule_trip", title: "📅 Schedule Trip" }],
    jobs: [{ id: "post_job", title: "📝 Post Job" }],
    business_broker: [{ id: "search_nearby", title: "📍 Search Nearby" }],
    real_estate: [{ id: "filter_properties", title: "🔍 Filter" }],
    farmer: [{ id: "list_produce", title: "🌾 List Produce" }],
    insurance: [{ id: "get_quote", title: "💰 Get Quote" }],
    sales: [{ id: "create_campaign", title: "📊 New Campaign" }],
    pharmacy: [{ id: "check_medicine", title: "💊 Check Medicine" }],
    support: [{ id: "human_support", title: "👤 Human Support" }],
    wallet: [{ id: "check_balance", title: "💰 Balance" }],
    general: [],
  };

  const buttons = [
    ...(agentSpecificButtons[agentType] || []),
    ...commonButtons,
  ];

  return validateActionButtons(buttons);
}
