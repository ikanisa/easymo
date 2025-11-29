import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Tool } from '../../core/types';

const searchCriteriaSchema = z.object({
  query: z.string().optional().describe('Search query text'),
  location: z.string().optional().describe('Location filter'),
  priceMin: z.number().optional().describe('Minimum price'),
  priceMax: z.number().optional().describe('Maximum price'),
  jobType: z.array(z.string()).optional().describe('Job types (full_time, part_time, contract, freelance)'),
  propertyType: z.array(z.string()).optional().describe('Property types (apartment, house, villa, office)'),
  bedrooms: z.number().optional().describe('Minimum bedrooms'),
  bathrooms: z.number().optional().describe('Minimum bathrooms'),
});

export const saveSearchTool: Tool = {
  name: 'save_search',
  description: 'Save a search query and set up notifications for new matches. Use this when a user wants to be notified of new job or property listings matching their criteria.',
  parameters: z.object({
    searchType: z.enum(['job', 'property']).describe('Type of search to save'),
    searchCriteria: searchCriteriaSchema.describe('Search criteria to save'),
    notificationFrequency: z.enum(['instant', 'daily', 'weekly']).default('daily').describe('How often to notify: instant (hourly), daily, or weekly'),
  }),
  
  handler: async (params, context) => {
    const { supabase, userId } = context;
    
    if (!userId) {
      throw new Error('User must be authenticated to save searches');
    }

    const { data, error } = await supabase
      .from('search_alerts')
      .insert({
        user_id: userId,
        search_type: params.searchType,
        search_criteria: params.searchCriteria,
        notification_frequency: params.notificationFrequency,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error saving search:', error);
      throw new Error(`Failed to save search: ${error.message}`);
    }
    
    const frequencyText = params.notificationFrequency === 'instant' ? 'hourly' : params.notificationFrequency;
    
    return {
      success: true,
      alertId: data.id,
      message: `✅ Search saved! You'll receive ${frequencyText} notifications when new ${params.searchType} listings match your criteria.`,
      alert: data,
    };
  },
};

export const listSavedSearchesTool: Tool = {
  name: 'list_saved_searches',
  description: 'List all active saved searches for the user. Use this when a user asks to see their saved searches or alerts.',
  parameters: z.object({
    searchType: z.enum(['job', 'property', 'all']).optional().default('all').describe('Filter by search type'),
  }),
  
  handler: async (params, context) => {
    const { supabase, userId } = context;
    
    if (!userId) {
      throw new Error('User must be authenticated');
    }

    let query = supabase
      .from('search_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (params.searchType && params.searchType !== 'all') {
      query = query.eq('search_type', params.searchType);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching saved searches:', error);
      throw new Error(`Failed to fetch saved searches: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      return {
        alerts: [],
        count: 0,
        message: 'You have no saved searches yet. Save a search to get notified of new matches!',
      };
    }

    const formattedAlerts = data.map((alert, index) => {
      const criteria = alert.search_criteria as any;
      const criteriaText = Object.entries(criteria)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

      return {
        number: index + 1,
        id: alert.id,
        type: alert.search_type,
        criteria: criteriaText || 'All listings',
        frequency: alert.notification_frequency,
        createdAt: alert.created_at,
      };
    });
    
    return {
      alerts: formattedAlerts,
      count: data.length,
      message: `You have ${data.length} saved search${data.length > 1 ? 'es' : ''}`,
    };
  },
};

export const deleteSavedSearchTool: Tool = {
  name: 'delete_saved_search',
  description: 'Delete a saved search alert. Use this when a user wants to stop receiving notifications for a specific search.',
  parameters: z.object({
    alertId: z.string().uuid().describe('ID of the alert to delete'),
  }),
  
  handler: async (params, context) => {
    const { supabase, userId } = context;
    
    if (!userId) {
      throw new Error('User must be authenticated');
    }

    const { error } = await supabase
      .from('search_alerts')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', params.alertId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error deleting search alert:', error);
      throw new Error(`Failed to delete search alert: ${error.message}`);
    }
    
    return {
      success: true,
      message: '✅ Search alert deleted successfully. You will no longer receive notifications for this search.',
    };
  },
};

export const updateSearchFrequencyTool: Tool = {
  name: 'update_search_frequency',
  description: 'Update the notification frequency for a saved search',
  parameters: z.object({
    alertId: z.string().uuid(),
    frequency: z.enum(['instant', 'daily', 'weekly']),
  }),
  
  handler: async (params, context) => {
    const { supabase, userId } = context;
    
    if (!userId) {
      throw new Error('User must be authenticated');
    }

    const { error } = await supabase
      .from('search_alerts')
      .update({ 
        notification_frequency: params.frequency,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.alertId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error updating search frequency:', error);
      throw new Error(`Failed to update frequency: ${error.message}`);
    }
    
    const frequencyText = params.frequency === 'instant' ? 'hourly' : params.frequency;
    
    return {
      success: true,
      message: `✅ Notification frequency updated to ${frequencyText}`,
    };
  },
};
