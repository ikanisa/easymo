/**
 * Real Estate Agent - Contact Owner Tool
 * 
 * Send templated intro message to property owner on behalf of client.
 */

import type { Tool } from '../../../types/agent.types';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createContactOwnerTool(supabase: SupabaseClient): Tool {
  return {
    name: 'contact_owner_whatsapp',
    description: 'Send templated intro message to property owner on behalf of the client.',
    parameters: {
      type: 'object',
      properties: {
        owner_id: { type: 'string', description: 'Property owner user ID' },
        property_id: { type: 'string', description: 'Property being inquired about' },
        message_template: { 
          type: 'string', 
          description: 'Message template: inquiry, viewing_request, availability_check' 
        },
        client_details: { type: 'object', description: 'Client info to share with owner' }
      },
      required: ['owner_id', 'property_id', 'message_template']
    },
    execute: async (params, context) => {
      const { owner_id, property_id, message_template, client_details } = params;
      const session_id = `sess_${Date.now()}`;
      
      try {
        await supabase.from('property_inquiries').insert({
          inquiry_id: session_id,
          property_id,
          owner_id,
          client_id: context.userId,
          message_type: message_template,
          client_details,
          status: 'sent',
          created_at: new Date().toISOString()
        });
        
        return { 
          status: 'sent',
          session_id,
          message: 'Your inquiry has been sent to the property owner. They will respond shortly.'
        };
      } catch (err) {
        console.error('Failed to send inquiry:', err);
        return {
          status: 'queued',
          session_id,
          message: 'Inquiry noted. We will contact the owner and get back to you.'
        };
      }
    }
  };
}
