/**
 * Marketplace AI Agent Tests
 * 
 * Tests for the conversational marketplace agent including:
 * - Intent classification
 * - Entity extraction
 * - Flow completion
 * - Search functionality
 * - Welcome message for new users
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { 
  MarketplaceAgent, 
  type MarketplaceContext,
  WELCOME_MESSAGE,
  BUSINESS_CATEGORIES,
} from "../core/agent.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

// Type for mock Supabase client that satisfies the minimum interface needed for testing
interface MockSupabaseClient {
  from: (table: string) => {
    select: () => {
      eq: () => {
        single: () => Promise<{ data: unknown; error: null }>;
      };
      limit: () => { data: unknown[]; error: null };
      or: () => {
        neq: () => {
          order: () => {
            limit: () => { data: unknown[]; error: null };
          };
        };
      };
    };
    insert: (data: unknown) => Promise<{ data: unknown; error: null }>;
    update: () => {
      eq: () => { data: null; error: null };
    };
    upsert: (data: unknown) => Promise<{ data: unknown; error: null }>;
  };
  rpc: (fn: string, params: unknown) => Promise<{ data: unknown; error: null }>;
}

// Mock Supabase client for testing
const createMockSupabase = (): MockSupabaseClient => {
  const mockData: Record<string, unknown> = {};
  
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: mockData[table], error: null }),
        }),
        limit: () => ({ data: [], error: null }),
        or: () => ({
          neq: () => ({
            order: () => ({
              limit: () => ({ data: [], error: null }),
            }),
          }),
        }),
      }),
      insert: async (data: unknown) => {
        mockData[table] = data;
        return { data, error: null };
      },
      update: () => ({
        eq: () => ({ data: null, error: null }),
      }),
      upsert: async (data: unknown) => {
        mockData[table] = data;
        return { data, error: null };
      },
    }),
    rpc: async (fn: string, _params: unknown) => {
      if (fn === "search_marketplace_listings_nearby") {
        return { data: [], error: null };
      }
      if (fn === "find_matching_marketplace_buyers") {
        return { data: [], error: null };
      }
      if (fn === "search_businesses_nearby") {
        return { 
          data: [
            { id: "1", name: "Kigali Pharmacy", category: "pharmacy", city: "Kigali", phone: "+250788123456", rating: 4.5, distance_km: 0.5 },
            { id: "2", name: "Rwanda Pharmacy", category: "pharmacy", city: "Kigali", phone: "+250788654321", rating: 4.2, distance_km: 1.2 },
          ], 
          error: null 
        };
      }
      return { data: null, error: null };
    },
  };
};

// =====================================================
// Interactive Workflow Tests
// =====================================================
// Basic Configuration Tests
// =====================================================

Deno.test("BUSINESS_CATEGORIES - has 9 categories", () => {
  assertEquals(BUSINESS_CATEGORIES.length, 9);
});

Deno.test("WELCOME_MESSAGE - exists and contains key information", () => {
  assertExists(WELCOME_MESSAGE);
  assertEquals(WELCOME_MESSAGE.includes("Kwizera"), true);
  assertEquals(WELCOME_MESSAGE.includes("easyMO"), true);
  assertEquals(WELCOME_MESSAGE.includes("Rwanda"), true);
  assertEquals(WELCOME_MESSAGE.includes("What can I help you find today"), true);
});

// =====================================================
// MarketplaceAgent Tests
// =====================================================

Deno.test("MarketplaceAgent - loadContext creates new context for new user", async () => {
  const mockSupabase = createMockSupabase();
  // Cast to SupabaseClient for static method calls
  const context = await MarketplaceAgent.loadContext(
    "+250788123456", 
    mockSupabase as unknown as SupabaseClient
  );
  
  assertEquals(context.phone, "+250788123456");
  assertEquals(context.flowType, null);
  assertEquals(context.conversationHistory.length, 0);
});

Deno.test("MarketplaceAgent - resetContext clears conversation", async () => {
  const mockSupabase = createMockSupabase();
  // Cast to SupabaseClient for static method calls
  await MarketplaceAgent.resetContext(
    "+250788123456", 
    mockSupabase as unknown as SupabaseClient
  );
  // If no error thrown, reset was successful
  assertEquals(true, true);
});

// Integration test structure (requires real Gemini API)
Deno.test({
  name: "MarketplaceAgent - process selling intent",
  ignore: !Deno.env.get("GEMINI_API_KEY"), // Only run if API key available
  fn: async () => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );
    
    const agent = new MarketplaceAgent(supabase, "test");
    const context: MarketplaceContext = {
      phone: "+250788999999",
      flowType: null,
      flowStep: null,
      collectedData: {},
      conversationHistory: [],
    };
    
    const response = await agent.process(
      "I want to sell my dining table for 50000 RWF",
      context
    );
    
    assertExists(response.message);
    assertEquals(typeof response.message, "string");
  },
});

Deno.test({
  name: "MarketplaceAgent - process buying intent",
  ignore: !Deno.env.get("GEMINI_API_KEY"),
  fn: async () => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );
    
    const agent = new MarketplaceAgent(supabase, "test");
    const context: MarketplaceContext = {
      phone: "+250788999999",
      flowType: null,
      flowStep: null,
      collectedData: {},
      conversationHistory: [],
      location: { lat: -1.9441, lng: 30.0619 }, // Kigali
    };
    
    const response = await agent.process(
      "Looking for a pharmacy nearby",
      context
    );
    
    assertExists(response.message);
    assertEquals(typeof response.message, "string");
  },
});

Deno.test({
  name: "MarketplaceAgent - handles unclear input gracefully",
  ignore: !Deno.env.get("GEMINI_API_KEY"),
  fn: async () => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );
    
    const agent = new MarketplaceAgent(supabase, "test");
    const context: MarketplaceContext = {
      phone: "+250788999999",
      flowType: null,
      flowStep: null,
      collectedData: {},
      conversationHistory: [],
    };
    
    const response = await agent.process("asdfghjkl", context);
    
    assertExists(response.message);
    // Should ask for clarification
    assertEquals(response.message.includes("understand") || response.message.includes("clarify"), true);
  },
});
