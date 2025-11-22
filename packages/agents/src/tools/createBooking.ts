/**
 * Tool: Create Booking
 * 
 * Creates a new bar-truck booking.
 */

import { z } from 'zod';

import { logToolInvocation } from '../observability';
import type { AgentContext } from '../types';

export const createBookingSchema = z.object({
  slotId: z.string().uuid().describe('ID of the time slot to book'),
  guestCount: z.number().int().min(1).max(20).describe('Number of guests'),
  specialRequests: z.string().optional().describe('Any special requests or notes'),
});

export type CreateBookingParams = z.infer<typeof createBookingSchema>;

interface Booking {
  id: string;
  userId: string;
  slotId: string;
  guestCount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  specialRequests?: string;
  createdAt: string;
}

/**
 * Execute booking creation
 */
export async function executeCreateBooking(
  params: CreateBookingParams,
  context: AgentContext
): Promise<{ booking: Booking }> {
  await logToolInvocation('CreateBooking', context, params);

  // Placeholder implementation
  // TODO: Insert into Supabase bookings table
  const booking: Booking = {
    id: `booking-${Date.now()}`,
    userId: context.userId,
    slotId: params.slotId,
    guestCount: params.guestCount,
    status: 'pending',
    specialRequests: params.specialRequests,
    createdAt: new Date().toISOString(),
  };

  return { booking };
}

export const createBookingTool = {
  name: 'CreateBooking',
  description: 'Create a new booking for a bar-truck time slot',
  parameters: createBookingSchema,
  execute: executeCreateBooking,
};
