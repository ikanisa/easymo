/**
 * Tool Registry - Centralized registration of all AI agent tools
 * 
 * This file exports all available tools and provides utilities
 * for registering and managing them.
 */

import type { Tool } from '../core/types';
// Booking tools
import { checkAvailabilityTool } from './booking/check-availability';
import { createBookingTool } from './booking/create-booking';
// Payment tools
import { checkBalanceTool } from './payment/check-balance';
import { sendMoneyTool } from './payment/send-money';
// Profile tools
import { getUserProfileTool } from './profile/get-user-profile';
// Support tools
import { createTicketTool } from './support/create-ticket';
// Search tools
import { openaiWebSearchTool } from './openai-web-search';
import { serpapiJobsTool } from './serpapi-jobs';

/**
 * All available tools
 */
export const ALL_TOOLS: Tool[] = [
  // Payment
  checkBalanceTool,
  sendMoneyTool,
  
  // Booking
  checkAvailabilityTool,
  createBookingTool,
  
  // Profile
  getUserProfileTool,
  
  // Support
  createTicketTool,

  // Search
  openaiWebSearchTool,
  serpapiJobsTool,
];

/**
 * Tool registry by name for quick lookup
 */
export const TOOL_REGISTRY: Record<string, Tool> = ALL_TOOLS.reduce(
  (acc, tool) => {
    acc[tool.name] = tool;
    return acc;
  },
  {} as Record<string, Tool>
);

/**
 * Get tool by name
 */
export function getTool(name: string): Tool | undefined {
  return TOOL_REGISTRY[name];
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string): Tool[] {
  return ALL_TOOLS.filter((tool) => tool.category === category);
}

/**
 * Get all tool names
 */
export function getAllToolNames(): string[] {
  return ALL_TOOLS.map((tool) => tool.name);
}

/**
 * Validate tool exists
 */
export function toolExists(name: string): boolean {
  return name in TOOL_REGISTRY;
}

/**
 * Get tool schema for OpenAI function calling
 */
export function getToolSchema(tool: Tool): any {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    },
  };
}

/**
 * Get all tools as OpenAI function schemas
 */
export function getAllToolSchemas(): any[] {
  return ALL_TOOLS.map(getToolSchema);
}

/**
 * Convert Zod schema to JSON Schema for OpenAI
 * This is a simplified version - for production, use zod-to-json-schema library
 */
function zodToJsonSchema(schema: any): any {
  // This would be implemented with proper zod-to-json-schema conversion
  // For now, returning a placeholder
  return {
    type: 'object',
    properties: {},
    required: [],
  };
}

// Export individual tools
export {
  createTicketTool,
  getUserProfileTool,
  openaiWebSearchTool,
  sendMoneyTool,
  serpapiJobsTool,
};
