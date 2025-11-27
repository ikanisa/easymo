import { z } from 'zod';
import type { Tool } from '../../core/types';

export const scheduleViewingTool: Tool = {
  name: 'schedule_property_viewing',
  description: 'Schedule a property viewing. Use this when a user wants to view a property.',
  parameters: z.object({
    propertyListingId: z.string().uuid().describe('ID of the property listing'),
    preferredDate: z.string().describe('Preferred viewing date (YYYY-MM-DD)'),
    preferredTime: z.string().optional().describe('Preferred time (HH:MM)'),
    notes: z.string().optional().describe('Special requests or notes'),
  }),
  
  handler: async (params, context) => {
    const { supabase, userId } = context;
    
    if (!userId) {
      throw new Error('User must be authenticated');
    }

    const viewingDateTime = `${params.preferredDate}T${params.preferredTime || '10:00'}:00`;
    const viewingDate = new Date(viewingDateTime);
    
    if (isNaN(viewingDate.getTime())) {
      throw new Error('Invalid date format. Please use YYYY-MM-DD for date and HH:MM for time.');
    }

    const { data, error } = await supabase
      .from('property_viewings')
      .insert({
        property_id: params.propertyListingId,
        whatsapp_user_id: userId,
        viewing_date: viewingDate.toISOString(),
        notes: params.notes,
        confirmation_status: 'pending',
        reminder_sent: false,
      })
      .select('*, property_listings(*)')
      .single();
    
    if (error) {
      console.error('Error scheduling viewing:', error);
      throw new Error(`Failed to schedule viewing: ${error.message}`);
    }
    
    const formattedDate = viewingDate.toLocaleDateString();
    const formattedTime = viewingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return {
      success: true,
      viewing: data,
      message: `✅ Viewing scheduled for ${formattedDate} at ${formattedTime}\n🏠 Property: ${data.property_listings?.title || 'Property'}\n📅 I'll send you a reminder 24 hours before.`,
    };
  },
};

export const listViewingsTool: Tool = {
  name: 'list_property_viewings',
  description: 'List all property viewings for the user',
  parameters: z.object({
    status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'all']).optional().default('all'),
  }),
  
  handler: async (params, context) => {
    const { supabase, userId } = context;
    
    if (!userId) {
      throw new Error('User must be authenticated');
    }

    let query = supabase
      .from('property_viewings')
      .select('*, property_listings(*)')
      .eq('whatsapp_user_id', userId)
      .order('viewing_date', { ascending: true });

    if (params.status && params.status !== 'all') {
      query = query.eq('confirmation_status', params.status);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching viewings:', error);
      throw new Error(`Failed to fetch viewings: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      return {
        viewings: [],
        count: 0,
        message: 'You have no scheduled viewings.',
      };
    }

    const now = new Date();
    const formattedViewings = data.map((viewing, index) => {
      const viewingDate = new Date(viewing.viewing_date);
      const isPast = viewingDate < now;
      
      return {
        number: index + 1,
        id: viewing.id,
        propertyTitle: viewing.property_listings?.title || 'Unknown Property',
        date: viewingDate.toLocaleDateString(),
        time: viewingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: viewing.confirmation_status,
        isPast,
        notes: viewing.notes,
      };
    });
    
    return {
      viewings: formattedViewings,
      count: data.length,
      message: `You have ${data.length} scheduled viewing${data.length > 1 ? 's' : ''}`,
    };
  },
};

export const cancelViewingTool: Tool = {
  name: 'cancel_property_viewing',
  description: 'Cancel a scheduled property viewing',
  parameters: z.object({
    viewingId: z.string().uuid(),
  }),
  
  handler: async (params, context) => {
    const { supabase, userId } = context;
    
    if (!userId) {
      throw new Error('User must be authenticated');
    }

    const { error } = await supabase
      .from('property_viewings')
      .update({ 
        confirmation_status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.viewingId)
      .eq('whatsapp_user_id', userId);
    
    if (error) {
      console.error('Error cancelling viewing:', error);
      throw new Error(`Failed to cancel viewing: ${error.message}`);
    }
    
    return {
      success: true,
      message: '✅ Viewing cancelled successfully',
    };
  },
};

export const confirmViewingTool: Tool = {
  name: 'confirm_property_viewing',
  description: 'Confirm a scheduled property viewing',
  parameters: z.object({
    viewingId: z.string().uuid(),
  }),
  
  handler: async (params, context) => {
    const { supabase, userId } = context;
    
    if (!userId) {
      throw new Error('User must be authenticated');
    }

    const { error } = await supabase
      .from('property_viewings')
      .update({ 
        confirmation_status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.viewingId)
      .eq('whatsapp_user_id', userId);
    
    if (error) {
      console.error('Error confirming viewing:', error);
      throw new Error(`Failed to confirm viewing: ${error.message}`);
    }
    
    return {
      success: true,
      message: '✅ Viewing confirmed! See you there!',
    };
  },
};
