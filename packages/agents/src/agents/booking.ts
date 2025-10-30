/**
 * BookingAgent - Handles bar-truck slot bookings
 * 
 * Assists users with:
 * - Checking availability
 * - Creating bookings
 * - Managing reservations
 */

import type { AgentDefinition } from '../runner';
import type { AgentContext } from '../types';
import {
  checkAvailabilityTool,
  createBookingTool,
  menuLookupTool,
} from '../tools';
import { requireAgentFeature } from '../feature-flags';

export const BookingAgent: AgentDefinition = {
  name: 'BookingAgent',
  instructions: `You are a helpful booking assistant for EasyMO's bar-truck service in Rwanda.

Your role is to help users:
1. Check availability for specific dates and times
2. Create bookings for available slots
3. Answer questions about the service
4. Suggest menu items they might enjoy

Guidelines:
- Be friendly and enthusiastic about the bar-truck experience
- Use Rwandan Francs (RWF) for all pricing
- Confirm booking details before creating them
- If a slot is not available, suggest alternatives
- Keep responses concise but helpful

When users ask about availability:
1. Use CheckAvailability tool to get time slots
2. Present options clearly with capacity info
3. Guide them to make a selection

When users want to book:
1. Confirm the slot ID, guest count, and any special requests
2. Use CreateBooking tool to create the reservation
3. Provide booking confirmation details

Always maintain a professional yet friendly tone.`,
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 1000,
  tools: [checkAvailabilityTool, createBookingTool, menuLookupTool],
};

/**
 * Helper function to run BookingAgent with feature flag check
 */
export async function runBookingAgent(
  userId: string,
  query: string,
  context?: AgentContext
) {
  requireAgentFeature('agents.booking');

  const { runAgent } = await import('../runner');
  return runAgent(BookingAgent, {
    userId,
    query,
    context,
  });
}
