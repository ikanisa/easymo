import { createClient, SupabaseClient } from '@supabase/supabase-js';

import type { AgentContext, AgentInput, AgentResult, Tool } from '../../types/agent.types';
import { BaseAgent } from '../base/agent.base';
import { REAL_ESTATE_SYSTEM_PROMPT } from './prompts';
import { createRealEstateTools } from './tools';
import { getRealEstateConfig, type RealEstateAgentConfig } from './config';

/**
 * Real Estate Agent - Unified Implementation
 * 
 * Consolidated agent for property search, owner communication, and viewings.
 * Uses modular tools and unified system prompt for consistent behavior.
 */
export class RealEstateAgent extends BaseAgent {
  name = 'real_estate_agent';
  instructions = REAL_ESTATE_SYSTEM_PROMPT;
  
  tools: Tool[];
  private supabase: SupabaseClient;
  private config: RealEstateAgentConfig;

  constructor(
    supabaseClient?: SupabaseClient,
    configOverrides?: Partial<RealEstateAgentConfig>
  ) {
    super();
    
    // Use provided client or create new one
    if (supabaseClient) {
      this.supabase = supabaseClient;
    } else {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
      
      this.supabase = createClient(supabaseUrl || '', supabaseKey || '', {
        auth: { persistSession: false }
      });
    }
    
    // Get configuration
    this.config = getRealEstateConfig(configOverrides);
    this.model = this.config.model;
    
    // Create tools with supabase client
    this.tools = createRealEstateTools(this.supabase);
  }
}
