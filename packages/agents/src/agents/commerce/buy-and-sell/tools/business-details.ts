/**
 * Business Details Tool
 * 
 * Fetch detailed information about a specific business.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { childLogger } from '@easymo/commons';
import type { Tool } from '../../../../types/agent.types';

const log = childLogger({ service: 'agents', tool: 'business-details' });

/**
 * Get full details for a specific business
 */
export function businessDetails(supabase: SupabaseClient): Tool {
  return {
    name: 'business_details',
    description: 'Fetch full details for a specific business by ID.',
    parameters: {
      type: 'object',
      properties: {
        business_id: { type: 'string', description: 'Unique business identifier' }
      },
      required: ['business_id']
    },
    execute: async (params, context) => {
      const { business_id } = params;
      
      log.info({ business_id }, 'Fetching business details');
      
      const { data, error } = await supabase
        .from('business_directory')
        .select('*')
        .eq('id', business_id)
        .single();

      if (error) {
        log.error({ error, business_id }, 'Failed to fetch business details');
        throw new Error(`Fetch details failed: ${error.message}`);
      }

      return data;
    }
  };
}
