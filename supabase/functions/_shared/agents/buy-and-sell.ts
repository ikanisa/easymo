/**
 * Buy & Sell Agent - Deno Runtime Wrapper
 * 
 * This is a Deno-compatible wrapper for the Buy & Sell AI agent.
 * It provides the same interface as the Node.js version but optimized for Supabase Edge Functions.
 * 
 * This wrapper delegates to the existing wa-webhook-buy-sell MarketplaceAgent for now,
 * but will eventually use a pure Deno implementation of the core agent logic.
 * 
 * @see docs/features/BUY_SELL_CONSOLIDATION_ANALYSIS.md
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../observability.ts";

// Import config constants (Deno-compatible)
export const BUY_SELL_AGENT_SLUG = 'buy_sell';
export const BUY_SELL_AGENT_NAME = 'Buy & Sell AI Agent';
export const BUY_SELL_DEFAULT_MODEL = 'gemini-1.5-flash';
export const DEFAULT_SEARCH_RADIUS_KM = 10;
export const DEFAULT_SEARCH_LIMIT = 5;

// Business categories
export const BUSINESS_CATEGORIES = [
  { code: "pharmacy", name: "Pharmacies", icon: "💊", description: "Pharmacies and medical supplies" },
  { code: "salon", name: "Salons & Barbers", icon: "💇", description: "Hair salons, barber shops, beauty services" },
  { code: "restaurant", name: "Restaurants", icon: "🍽️", description: "Restaurants, cafes, and food services" },
  { code: "supermarket", name: "Supermarkets", icon: "🛒", description: "Supermarkets and grocery stores" },
  { code: "hardware", name: "Hardware Stores", icon: "🔧", description: "Hardware stores and construction supplies" },
  { code: "bank", name: "Banks & Finance", icon: "🏦", description: "Banks, microfinance, and mobile money" },
  { code: "hospital", name: "Hospitals & Clinics", icon: "🏥", description: "Hospitals, clinics, and health centers" },
  { code: "hotel", name: "Hotels & Lodging", icon: "🏨", description: "Hotels, guesthouses, and accommodations" },
  { code: "transport", name: "Transport & Logistics", icon: "🚗", description: "Transport services, taxis, and delivery" },
] as const;

export const EMOJI_NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"] as const;

// =====================================================
// TYPES
// =====================================================

export interface BuyAndSellContext {
  phone: string;
  flowType?: "selling" | "buying" | "inquiry" | "category_selection" | "awaiting_location" | "show_results" | "vendor_outreach" | null;
  flowStep?: string | null;
  collectedData?: Record<string, unknown>;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  location?: { lat: number; lng: number };
  currentListingId?: string | null;
  currentIntentId?: string | null;
  selectedCategory?: string;
  searchResults?: Array<Record<string, unknown>>;
  pendingVendorOutreach?: {
    businessIds: string[];
    requestSummary: string;
    requestType: "product" | "service" | "medicine";
    awaitingConsent: boolean;
  };
  currentInquiryId?: string | null;
}

export interface BuyAndSellResult {
  message: string;
  action?: string;
  data?: Record<string, unknown>;
  nextStep?: string;
  flowComplete?: boolean;
  vendorOutreach?: {
    shouldOffer: boolean;
    businessCount: number;
    awaitingConsent: boolean;
    inquiryId?: string;
  };
}

export interface AgentInput {
  message: string;
  context?: BuyAndSellContext;
}

// =====================================================
// BUY & SELL AGENT (DENO)
// =====================================================

/**
 * Buy & Sell Agent for Deno/Edge Functions
 * 
 * This is a lightweight wrapper around the core agent logic.
 * For now, it delegates to the wa-webhook-buy-sell MarketplaceAgent,
 * but can be refactored to use pure Deno implementation later.
 */
export class BuyAndSellAgent {
  private supabase: SupabaseClient;
  
  static readonly SLUG = BUY_SELL_AGENT_SLUG;
  static readonly NAME = BUY_SELL_AGENT_NAME;
  
  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }
  
  /**
   * Execute the agent with a message and context
   */
  async execute(input: AgentInput): Promise<BuyAndSellResult> {
    const { message, context } = input;
    
    await logStructuredEvent("AGENT_EXECUTE_START", {
      agent: BUY_SELL_AGENT_SLUG,
      phone: context?.phone,
      messageLength: message.length
    });
    
    try {
      // For now, delegate to the existing MarketplaceAgent implementation
      // TODO: Replace with pure Deno implementation after Phase 5 testing
      const { MarketplaceAgent } = await import("../../wa-webhook-buy-sell/agent.ts");
      const agent = new MarketplaceAgent(this.supabase);
      
      // Convert context format if needed
      const marketplaceContext = context as any;
      
      const result = await agent.process(message, marketplaceContext);
      
      await logStructuredEvent("AGENT_EXECUTE_SUCCESS", {
        agent: BUY_SELL_AGENT_SLUG,
        phone: context?.phone,
        action: result.action
      });
      
      return result;
    } catch (error) {
      await logStructuredEvent("AGENT_EXECUTE_ERROR", {
        agent: BUY_SELL_AGENT_SLUG,
        phone: context?.phone,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
  
  /**
   * Search for businesses using AI-powered search
   */
  async searchBusinesses(params: {
    query: string;
    lat?: number;
    lng?: number;
    radius_km?: number;
    limit?: number;
  }) {
    const { 
      query, 
      lat = null, 
      lng = null, 
      radius_km = DEFAULT_SEARCH_RADIUS_KM, 
      limit = DEFAULT_SEARCH_LIMIT 
    } = params;
    
    const { data, error } = await this.supabase.rpc('search_businesses_ai', {
      p_query: query,
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radius_km,
      p_limit: limit
    });
    
    if (error) {
      throw new Error(`Business search failed: ${error.message}`);
    }
    
    return data;
  }
}

/**
 * Backward compatibility alias
 * @deprecated Use BuyAndSellAgent instead
 */
export class MarketplaceAgent extends BuyAndSellAgent {
  constructor(supabaseClient: SupabaseClient) {
    super(supabaseClient);
    console.warn('MarketplaceAgent is deprecated. Use BuyAndSellAgent instead.');
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Create a Buy & Sell agent instance with default Supabase client
 */
export function createBuyAndSellAgent(): BuyAndSellAgent {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  return new BuyAndSellAgent(supabase);
}

/**
 * Load agent context from database
 */
export async function loadContext(
  phone: string,
  supabase: SupabaseClient
): Promise<BuyAndSellContext> {
  const { data, error } = await supabase
    .from('marketplace_context')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load context: ${error.message}`);
  }

  return data || {
    phone,
    flowType: null,
    flowStep: null,
    collectedData: {},
    conversationHistory: [],
  };
}

/**
 * Save agent context to database
 */
export async function saveContext(
  context: BuyAndSellContext,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from('marketplace_context')
    .upsert({
      phone: context.phone,
      flow_type: context.flowType,
      flow_step: context.flowStep,
      collected_data: context.collectedData,
      conversation_history: context.conversationHistory,
      location: context.location,
      current_listing_id: context.currentListingId,
      current_intent_id: context.currentIntentId,
      selected_category: context.selectedCategory,
      search_results: context.searchResults,
      pending_vendor_outreach: context.pendingVendorOutreach,
      current_inquiry_id: context.currentInquiryId,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to save context: ${error.message}`);
  }
}

/**
 * Reset agent context for a phone number
 */
export async function resetContext(
  phone: string,
  supabase: SupabaseClient
): Promise<void> {
  await supabase
    .from('marketplace_context')
    .delete()
    .eq('phone', phone);
}
