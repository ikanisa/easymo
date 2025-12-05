/**
 * Call Center AGI - Complete Implementation
 * 
 * Universal voice-first AI with:
 * - Full tool catalog (20+ tools)
 * - Agent-to-agent orchestration
 * - Knowledge base integration
 * - Database-driven configuration
 * - Voice-optimized responses
 */

import {
  BaseAgent,
  type AgentProcessParams,
  type AgentResponse,
  type ConversationMessage,
} from '../_shared/ai-agents/index.ts';
import { GeminiProvider } from '../_shared/ai-agents/providers/gemini.ts';
import { logStructuredEvent } from '../_shared/observability.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4.26.0';

// Constants for deep search configuration
const DEEP_SEARCH_MAX_TOKENS = 1500;
const DEEP_SEARCH_MAX_RESULTS = 5;
const DEEP_SEARCH_MAX_INPUT_LENGTH = 200; // Maximum characters for user input

/**
 * Sanitize user input to prevent prompt injection
 * Removes special characters and limits length
 */
function sanitizeSearchInput(input: string | undefined, maxLength: number = DEEP_SEARCH_MAX_INPUT_LENGTH): string {
  if (!input) return '';
  // Remove potential injection patterns and special characters
  return input
    .replace(/[<>{}[\]\\\/'"`;]/g, '') // Remove special characters
    .replace(/\n|\r|\t/g, ' ') // Replace newlines/tabs with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
    .slice(0, maxLength);
}

// Lazy-initialized OpenAI client singleton
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}
import { 
  deepSearchJobs, 
  deepSearchRealEstate,
  deepSearchToolDefinitions 
} from './tools/deep-search-tools.ts';

interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class CallCenterAGI extends BaseAgent {
  type = 'call_center';
  name = '📞 EasyMO Call Center AGI';
  description = 'Universal voice-first AI for all EasyMO services';

  private aiProvider: GeminiProvider;
  private tools: Map<string, Function>;

  constructor() {
    super();
    this.aiProvider = new GeminiProvider();
    this.tools = this.initializeTools();
  }

  /**
   * Initialize all tool executors
   */
  private initializeTools(): Map<string, Function> {
    const tools = new Map<string, Function>();

    // Identity & Profiles
    tools.set('get_or_create_profile', this.getOrCreateProfile.bind(this));
    tools.set('update_profile_basic', this.updateProfileBasic.bind(this));

    // Knowledge
    tools.set('kb_search_easymo', this.searchKnowledgeBase.bind(this));

    // Agent dispatch
    tools.set('run_agent', this.runAgent.bind(this));

    // Rides
    tools.set('rides_schedule_trip', this.ridesScheduleTrip.bind(this));
    tools.set('rides_add_vehicle', this.ridesAddVehicle.bind(this));

    // Property
    tools.set('real_estate_create_listing', this.realEstateCreateListing.bind(this));
    tools.set('real_estate_search', this.realEstateSearch.bind(this));

    // Jobs
    tools.set('jobs_create_listing', this.jobsCreateListing.bind(this));
    tools.set('jobs_register_candidate', this.jobsRegisterCandidate.bind(this));

    // Marketplace
    tools.set('marketplace_register_vendor', this.marketplaceRegisterVendor.bind(this));

    // Insurance, Legal, Pharmacy
    tools.set('insurance_create_lead', this.insuranceCreateLead.bind(this));
    tools.set('legal_notary_create_lead', this.legalNotaryCreateLead.bind(this));
    tools.set('pharmacy_create_lead', this.pharmacyCreateLead.bind(this));

    // Wallet & Payments
    tools.set('wallet_get_balance', this.walletGetBalance.bind(this));
    tools.set('wallet_initiate_token_transfer', this.walletInitiateTokenTransfer.bind(this));
    tools.set('momo_generate_qr', this.momoGenerateQR.bind(this));

    // Call logging
    tools.set('supabase_log_call_summary', this.logCallSummary.bind(this));
    tools.set('get_call_metadata', this.getCallMetadata.bind(this));

    // Deep Search (real-time web search - no data stored)
    // Deep Search (OpenAI Deep Research API)
    tools.set('deep_search_jobs', this.deepSearchJobs.bind(this));
    tools.set('deep_search_real_estate', this.deepSearchRealEstate.bind(this));

    return tools;
  }

  /**
   * Get tool count for health check
   */
  getToolCount(): number {
    return this.tools.size;
  }

  async process(params: AgentProcessParams): Promise<AgentResponse> {
    const { phone, message, session, supabase, context } = params;

    try {
      const isConsultation = context?.isConsultation === true;

      await logStructuredEvent('CALL_CENTER_AGI_PROCESSING', {
        phone: phone.slice(-4),
        isConsultation,
      });

      // Load configuration from database
      const config = await this.loadConfig(supabase);
      const systemPrompt = config?.systemPrompt || await this.getSystemPromptAsync(supabase);

      const messages: ConversationMessage[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history
      if (session.conversationHistory) {
        messages.push(...session.conversationHistory);
      }

      // Add current message
      messages.push({ role: 'user', content: message });

      // Generate AI response with tools
      const aiResponse = await this.aiProvider.chat(messages, {
        temperature: 0.7,
        maxTokens: 1500,
        model: 'gemini-2.0-flash-exp',
        tools: this.getGeminiTools(),
      });

      // Track tools used
      const toolsUsed: string[] = [];

      // Execute tool calls if any
      if (aiResponse.includes('[TOOL_CALL:')) {
        const toolExecutions = await this.executeToolCalls(aiResponse, supabase, phone);
        toolsUsed.push(...toolExecutions.map(t => t.tool));
      }

      // Log interaction
      await this.logInteraction(session, message, aiResponse, supabase, {
        agentType: this.type,
        toolsUsed,
        isConsultation,
      });

      await logStructuredEvent('CALL_CENTER_AGI_RESPONSE', {
        responseLength: aiResponse.length,
        toolsUsed: toolsUsed.length,
      });

      return {
        message: aiResponse,
        agentType: this.type,
        metadata: {
          model: 'gemini-2.0-flash-exp',
          toolsUsed,
          configSource: config?.loadedFrom || 'default',
        },
      };

    } catch (error) {
      await logStructuredEvent('CALL_CENTER_AGI_ERROR', {
        error: error instanceof Error ? error.message : String(error),
      }, 'error');

      return {
        message: "I apologize, I'm having trouble right now. Let me transfer you to support.",
        agentType: this.type,
        metadata: { error: true },
      };
    }
  }

  /**
   * Get Gemini-compatible tool definitions
   */
  private getGeminiTools(): any[] {
    return [
      {
        name: 'get_or_create_profile',
        description: 'Get or create user profile by phone number',
        parameters: {
          type: 'object',
          properties: {
            phone_number: { type: 'string', description: 'Phone number in E.164 format' },
          },
          required: ['phone_number'],
        },
      },
      {
        name: 'kb_search_easymo',
        description: 'Search EasyMO knowledge base for service information',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            top_k: { type: 'integer', description: 'Number of results', default: 5 },
          },
          required: ['query'],
        },
      },
      {
        name: 'run_agent',
        description: 'Call a specialized agent for complex queries',
        parameters: {
          type: 'object',
          properties: {
            agent_id: { 
              type: 'string',
              enum: ['real-estate-rentals', 'rides-matching', 'jobs-marketplace', 'waiter-restaurants', 'insurance-broker', 'farmers-market'],
              description: 'Specialist agent ID'
            },
            intent: { type: 'string', description: 'User intent' },
            parameters: { type: 'object', description: 'Additional parameters' },
          },
          required: ['agent_id', 'intent'],
        },
      },
      {
        name: 'deep_search_jobs',
        description: 'Search external job websites in real-time for job listings. Use this after checking our internal job_listings table when user wants more options.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Job search query (e.g., "software developer", "driver", "accountant")' },
            location: { type: 'string', description: 'Location (e.g., "Kigali", "Malta")' },
            country: { type: 'string', enum: ['RW', 'MT'], description: 'Country code' },
          },
          required: ['query'],
        },
      },
      {
        name: 'deep_search_real_estate',
        description: 'Search external property websites in real-time for rentals or properties for sale. Use this after checking our internal property_listings table when user wants more options.',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'Location (e.g., "Kimironko", "Kigali", "Sliema")' },
            listing_type: { type: 'string', enum: ['rent', 'buy'], description: 'Rent or buy' },
            bedrooms: { type: 'integer', description: 'Number of bedrooms' },
            max_price: { type: 'number', description: 'Maximum price' },
            country: { type: 'string', enum: ['RW', 'MT'], description: 'Country code' },
          },
          required: ['location', 'listing_type'],
        },
      },
    ];
  }

  /**
   * Execute tool calls from AI response
   */
  private async executeToolCalls(
    response: string,
    supabase: SupabaseClient,
    phone: string
  ): Promise<Array<{ tool: string; result: any }>> {
    const results: Array<{ tool: string; result: any }> = [];
    
    // Parse tool calls (simplified)
    const toolMatches = response.matchAll(/\[TOOL_CALL:(\w+)\((.*?)\)\]/g);
    
    for (const match of toolMatches) {
      const toolName = match[1];
      const argsStr = match[2];
      
      try {
        const args = JSON.parse(argsStr);
        const executor = this.tools.get(toolName);
        
        if (executor) {
          const result = await executor(args, supabase, phone);
          results.push({ tool: toolName, result });
        }
      } catch (error) {
        await logStructuredEvent('TOOL_EXECUTION_ERROR', {
          tool: toolName,
          error: error instanceof Error ? error.message : String(error),
        }, 'error');
      }
    }
    
    return results;
  }

  // ================================================================
  // TOOL IMPLEMENTATIONS
  // ================================================================

  private async getOrCreateProfile(args: any, supabase: SupabaseClient, phone: string): Promise<ToolExecutionResult> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .upsert({
          phone: args.phone_number || phone,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'phone',
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: profile };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async updateProfileBasic(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          name: args.name,
          preferred_language: args.preferred_language,
          role: args.role,
          updated_at: new Date().toISOString(),
        })
        .eq('id', args.profile_id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async searchKnowledgeBase(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      // Vector search in knowledge base
      const { data, error } = await supabase
        .rpc('search_knowledge_base', {
          query_text: args.query,
          match_count: args.top_k || 5,
        });

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async runAgent(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      // Call specialized agent via HTTP
      const agentUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${args.agent_id}`;
      
      const response = await fetch(agentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'X-Agent-Consultation': 'true',
          'X-Source-Agent': 'call_center',
        },
        body: JSON.stringify({
          intent: args.intent,
          parameters: args.parameters,
          caller_profile: args.caller_profile,
        }),
      });

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async ridesScheduleTrip(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('trips')
        .insert({
          profile_id: args.profile_id,
          pickup_location: args.pickup_location,
          dropoff_location: args.dropoff_location,
          scheduled_time: args.time,
          recurrence: args.recurrence,
          vehicle_type: args.vehicle_type,
          status: 'scheduled',
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async ridesAddVehicle(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          profile_id: args.profile_id,
          vehicle_type: args.vehicle_type,
          plate_number: args.plate_number,
          metadata: args.extra_meta,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async realEstateCreateListing(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('property_listings')
        .insert({
          profile_id: args.profile_id,
          listing_type: args.listing_type,
          country: args.country || 'RW',
          city: args.city,
          area: args.area,
          bedrooms: args.bedrooms,
          price: args.price,
          currency: args.currency || 'RWF',
          notes: args.notes,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async realEstateSearch(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      let query = supabase.from('property_listings').select('*');

      if (args.filters.city) query = query.eq('city', args.filters.city);
      if (args.filters.bedrooms) query = query.eq('bedrooms', args.filters.bedrooms);
      if (args.filters.max_price) query = query.lte('price', args.filters.max_price);
      if (args.filters.listing_type) query = query.eq('listing_type', args.filters.listing_type);

      const { data, error } = await query.limit(10);

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async jobsCreateListing(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('job_listings')
        .insert({
          profile_id: args.profile_id,
          title: args.title,
          description: args.description,
          location: args.location,
          pay_type: args.pay_type,
          pay_amount: args.pay_amount,
          duration: args.duration,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async jobsRegisterCandidate(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('job_candidates')
        .insert({
          profile_id: args.profile_id,
          skills: args.skills,
          preferred_roles: args.preferred_roles,
          preferred_locations: args.preferred_locations,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async marketplaceRegisterVendor(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('marketplace_vendors')
        .insert({
          profile_id: args.profile_id,
          category: args.category,
          products: args.products,
          location: args.location,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async insuranceCreateLead(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('insurance_leads')
        .insert({
          profile_id: args.profile_id,
          insurance_type: args.insurance_type,
          notes: args.notes,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async legalNotaryCreateLead(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('legal_leads')
        .insert({
          profile_id: args.profile_id,
          topic: args.topic,
          description: args.description,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async pharmacyCreateLead(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('pharmacy_leads')
        .insert({
          profile_id: args.profile_id,
          need_type: args.need_type,
          description: args.description,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async walletGetBalance(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data: wallet, error } = await supabase
        .from('wallets')
        .select('*, transactions:wallet_transactions(*)')
        .eq('profile_id', args.profile_id)
        .single();

      if (error) throw error;

      return { success: true, data: wallet };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async walletInitiateTokenTransfer(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .insert({
          from_profile_id: args.from_profile_id,
          to_phone_number: args.to_phone_number,
          amount: args.amount,
          type: 'transfer',
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async momoGenerateQR(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('payment_qr_codes')
        .insert({
          profile_id: args.profile_id,
          amount: args.amount_rwf,
          currency: 'RWF',
          purpose: args.purpose,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async logCallSummary(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      const { data, error } = await supabase
        .from('call_summaries')
        .insert({
          call_id: args.call_id,
          profile_id: args.profile_id,
          primary_intent: args.primary_intent,
          secondary_intents: args.secondary_intents,
          summary: args.summary_text,
          transcript_ref: args.raw_transcript_reference,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async getCallMetadata(args: any, supabase: SupabaseClient, phone: string): Promise<ToolExecutionResult> {
    return {
      success: true,
      data: {
        call_id: crypto.randomUUID(),
        phone_number: phone,
        started_at: new Date().toISOString(),
        channel: 'whatsapp_call',
      },
    };
  }

  // ================================================================
  // DEEP SEARCH TOOLS (Real-time web search - no data stored)
  // ================================================================

  /**
   * Search external job websites in real-time using OpenAI web search
   * Results are NOT stored in the database - they are live results
   */
  private async deepSearchJobs(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      // Sanitize user inputs to prevent prompt injection
      const sanitizedQuery = sanitizeSearchInput(args.query);
      const sanitizedLocation = sanitizeSearchInput(args.location);
      const sanitizedCountry = (args.country === 'MT' || args.country === 'RW') ? args.country : 'RW';

      if (!sanitizedQuery) {
        return { success: false, error: 'Search query is required' };
      }

      await logStructuredEvent('DEEP_SEARCH_JOBS_START', {
        query: sanitizedQuery,
        location: sanitizedLocation,
        country: sanitizedCountry,
      });

      // 1. Get target URLs from job_sources table
      const { data: sources } = await supabase
        .from('job_sources')
        .select('url, name')
        .eq('is_active', true)
        .eq('country', sanitizedCountry)
        .order('priority', { ascending: false })
        .limit(DEEP_SEARCH_MAX_RESULTS);

      const targetSites = sources?.map((s: { url: string }) => s.url) || [];

      // 2. Call OpenAI API with web search using singleton client
      const openai = getOpenAIClient();
      
      const locationText = sanitizedLocation || (sanitizedCountry === 'MT' ? 'Malta' : 'Rwanda');
      const sitesList = targetSites.length > 0 
        ? `Search these sites: ${targetSites.join(', ')}.`
        : '';
      
      const prompt = `Find job listings for "${sanitizedQuery}" in ${locationText}. 
                     ${sitesList}
                     Return for each job: title, company, location, salary range if available, key requirements, and URL to apply.
                     Limit to ${DEEP_SEARCH_MAX_RESULTS} most relevant recent listings.
                     Format as a clear numbered list.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a job search assistant. Search the web for current job listings and provide accurate, helpful results. Include direct URLs when available.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: DEEP_SEARCH_MAX_TOKENS,
      });

      const results = completion.choices[0]?.message?.content || 'No results found';

      await logStructuredEvent('DEEP_SEARCH_JOBS_COMPLETE', {
        query: sanitizedQuery,
        resultsLength: results.length,
      });

      // 3. Return results (NOT stored in DB)
      return {
        success: true,
        data: {
          jobs: results,
          sources_searched: targetSites,
          note: 'These are live results from external websites, not stored in our database.',
        },
      };
    } catch (error) {
      await logStructuredEvent('DEEP_SEARCH_JOBS_ERROR', {
        error: error instanceof Error ? error.message : String(error),
      }, 'error');
      return { success: false, error: error instanceof Error ? error.message : 'Deep search failed' };
    }
  }

  /**
   * Search external property websites in real-time using OpenAI web search
   * Results are NOT stored in the database - they are live results
   */
  private async deepSearchRealEstate(args: any, supabase: SupabaseClient): Promise<ToolExecutionResult> {
    try {
      // Sanitize user inputs to prevent prompt injection
      const sanitizedLocation = sanitizeSearchInput(args.location);
      const sanitizedCountry = (args.country === 'MT' || args.country === 'RW') ? args.country : 'RW';
      const sanitizedListingType = (args.listing_type === 'rent' || args.listing_type === 'buy') ? args.listing_type : 'rent';
      const sanitizedBedrooms = typeof args.bedrooms === 'number' && args.bedrooms > 0 && args.bedrooms < 20 ? args.bedrooms : null;
      const sanitizedMaxPrice = typeof args.max_price === 'number' && args.max_price > 0 ? args.max_price : null;

      if (!sanitizedLocation) {
        return { success: false, error: 'Location is required' };
      }

      await logStructuredEvent('DEEP_SEARCH_REAL_ESTATE_START', {
        location: sanitizedLocation,
        listing_type: sanitizedListingType,
        country: sanitizedCountry,
      });

      // 1. Get target URLs from real_estate_sources table
      const { data: sources } = await supabase
        .from('real_estate_sources')
        .select('url, name')
        .eq('is_active', true)
        .eq('country', sanitizedCountry)
        .order('priority', { ascending: false })
        .limit(DEEP_SEARCH_MAX_RESULTS);

      const targetSites = sources?.map((s: { url: string }) => s.url) || [];

      // 2. Build search query with sanitized inputs
      const currency = sanitizedCountry === 'MT' ? 'EUR' : 'RWF';
      const priceFilter = sanitizedMaxPrice ? `under ${sanitizedMaxPrice} ${currency}` : '';
      const bedroomFilter = sanitizedBedrooms ? `${sanitizedBedrooms} bedroom` : '';
      const listingType = sanitizedListingType === 'rent' ? 'rental' : 'for sale';
      const sitesList = targetSites.length > 0 
        ? `Search these sites: ${targetSites.join(', ')}.`
        : '';
      
      const prompt = `Find ${listingType} properties in ${sanitizedLocation}.
                     ${bedroomFilter} ${priceFilter}.
                     ${sitesList}
                     Return for each property: title, price, bedrooms, bathrooms, location/address, key amenities, contact info if available, and listing URL.
                     Limit to ${DEEP_SEARCH_MAX_RESULTS} most relevant listings.
                     Format as a clear numbered list.`;

      // 3. Call OpenAI API with web search using singleton client
      const openai = getOpenAIClient();
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a real estate search assistant. Search the web for current property listings and provide accurate, helpful results. Include direct URLs and contact information when available.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: DEEP_SEARCH_MAX_TOKENS,
      });

      const results = completion.choices[0]?.message?.content || 'No results found';

      await logStructuredEvent('DEEP_SEARCH_REAL_ESTATE_COMPLETE', {
        location: sanitizedLocation,
        resultsLength: results.length,
      });

      return {
        success: true,
        data: {
          properties: results,
          sources_searched: targetSites,
          note: 'These are live results from external websites.',
        },
      };
    } catch (error) {
      await logStructuredEvent('DEEP_SEARCH_REAL_ESTATE_ERROR', {
        error: error instanceof Error ? error.message : String(error),
      }, 'error');
      return { success: false, error: error instanceof Error ? error.message : 'Deep search failed' };
  /**
   * Deep Search Jobs - Search internal DB + web via OpenAI Deep Research API
   */
  private async deepSearchJobs(args: any, supabase: SupabaseClient, phone: string): Promise<ToolExecutionResult> {
    try {
      // Get user ID for tracking
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('whatsapp_e164', phone)
        .single();

      const result = await deepSearchJobs(
        supabase,
        {
          query: args.query,
          country: args.country || 'RW',
          context: args.context || {},
        },
        profile?.user_id
      );

      return { success: true, data: result };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Deep search failed' 
      };
    }
  }

  /**
   * Deep Search Real Estate - Search internal DB + web via OpenAI Deep Research API
   */
  private async deepSearchRealEstate(args: any, supabase: SupabaseClient, phone: string): Promise<ToolExecutionResult> {
    try {
      // Get user ID for tracking
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('whatsapp_e164', phone)
        .single();

      const result = await deepSearchRealEstate(
        supabase,
        {
          query: args.query,
          country: args.country || 'RW',
          context: args.context || {},
        },
        profile?.user_id
      );

      return { success: true, data: result };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Deep search failed' 
      };
    }
  }

  async getSystemPromptAsync(supabase: SupabaseClient): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('ai_agent_system_instructions')
        .select('instructions')
        .eq('agent_id', (
          await supabase
            .from('ai_agents')
            .select('id')
            .eq('slug', 'call_center')
            .single()
        ).data?.id)
        .eq('is_active', true)
        .single();

      if (!error && data) {
        return data.instructions;
      }
    } catch (error) {
      await logStructuredEvent('SYSTEM_PROMPT_LOAD_ERROR', {
        error: error instanceof Error ? error.message : String(error),
      }, 'warn');
    }

    return this.getDefaultSystemPrompt();
  }

  getDefaultSystemPrompt(): string {
    return `You are the EasyMO Call Center AI - the single front-door for all EasyMO services.

CHANNEL: Voice calls (WhatsApp audio and phone)
STYLE: Short, clear, natural voice responses

SERVICES YOU HANDLE:
- Rides & Delivery
- Real Estate
- Jobs & Employment
- Marketplace (Farmers, Vendors)
- Insurance
- Legal/Notary
- Pharmacy
- Wallet & Tokens
- MoMo QR Payments

CONVERSATION:
- Warm greeting
- One question at a time
- Confirm understanding
- Number choices clearly
- Mirror caller's language

TOOLS: Use tools to help users - create profiles, search knowledge, route to specialists.

You are patient, helpful, and voice-optimized.`;
  }
}
