/**
 * Tool: Check Availability
 * 
 * Checks availability of bar-truck time slots.
 */

import { z } from 'zod';
import type { AgentContext } from '../types';
import { logToolInvocation } from '../observability';

export const checkAvailabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date in YYYY-MM-DD format'),
  location: z.string().optional().describe('Preferred location'),
});

export type CheckAvailabilityParams = z.infer<typeof checkAvailabilitySchema>;

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  location: string;
  available: boolean;
  capacity: number;
  booked: number;
}

/**
 * Execute availability check
 */
export async function executeCheckAvailability(
  params: CheckAvailabilityParams,
  context: AgentContext
): Promise<{ slots: TimeSlot[] }> {
  await logToolInvocation('CheckAvailability', context, params);

  // Placeholder implementation
  // TODO: Query Supabase bookings table
  const mockSlots: TimeSlot[] = [
    {
      id: 'slot-1',
      startTime: '17:00',
      endTime: '19:00',
      location: 'Kigali City Center',
      available: true,
      capacity: 50,
      booked: 15,
    },
    {
      id: 'slot-2',
      startTime: '19:00',
      endTime: '21:00',
      location: 'Kigali City Center',
      available: true,
      capacity: 50,
      booked: 35,
    },
    {
      id: 'slot-3',
      startTime: '21:00',
      endTime: '23:00',
      location: 'Kigali City Center',
      available: false,
      capacity: 50,
      booked: 50,
    },
  ];

  return { slots: mockSlots };
}

export const checkAvailabilityTool = {
  name: 'CheckAvailability',
  description: 'Check available time slots for bar-truck bookings on a specific date',
  parameters: checkAvailabilitySchema,
  execute: executeCheckAvailability,
};
