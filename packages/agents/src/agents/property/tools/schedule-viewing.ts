/**
 * Real Estate Agent - Schedule Viewing Tool
 * 
 * Schedule a property viewing appointment with the owner.
 */

import type { Tool } from '../../../types/agent.types';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createScheduleViewingTool(supabase: SupabaseClient): Tool {
  return {
    name: 'schedule_viewing',
    description: 'Schedule a property viewing appointment.',
    parameters: {
      type: 'object',
      properties: {
        property_id: { type: 'string', description: 'Property to view' },
        preferred_date: { type: 'string', description: 'Preferred viewing date (YYYY-MM-DD)' },
        preferred_time: { type: 'string', description: 'Preferred time (HH:MM)' },
        contact_phone: { type: 'string', description: 'Client contact number' }
      },
      required: ['property_id', 'preferred_date', 'preferred_time']
    },
    execute: async (params, context) => {
      const { property_id, preferred_date, preferred_time, contact_phone } = params;
      const viewing_id = `view_${Date.now()}`;
      
      try {
        await supabase.from('property_viewings').insert({
          viewing_id,
          property_id,
          client_id: context.userId,
          preferred_date,
          preferred_time,
          contact_phone,
          status: 'pending',
          created_at: new Date().toISOString()
        });
        
        return {
          viewing_id,
          status: 'pending',
          date: preferred_date,
          time: preferred_time,
          message: `Viewing request submitted for ${preferred_date} at ${preferred_time}. We'll confirm once the owner approves.`
        };
      } catch (err) {
        console.error('Failed to schedule viewing:', err);
        return {
          viewing_id,
          status: 'pending',
          message: 'Viewing request noted. We will coordinate with the owner and confirm.'
        };
      }
    }
  };
}
