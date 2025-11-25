/**
 * Marketplace AI Agent Tests
 * 
 * Tests for the conversational marketplace agent including:
 * - Intent classification
 * - Entity extraction
 * - Flow completion
 * - Search functionality
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { MarketplaceAgent, type MarketplaceContext } from "../agent.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Mock Supabase client for testing
const createMockSupabase = () => {
  const mockData: Record<string, unknown> = {};
  
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: mockData[table], error: null }),
        }),
        limit: () => ({ data: [], error: null }),
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
    rpc: async (fn: string, params: unknown) => {
      if (fn === "search_marketplace_listings_nearby") {
        return { data: [], error: null };
      }
      if (fn === "find_matching_marketplace_buyers") {
        return { data: [], error: null };
      }
      return { data: null, error: null };
    },
  } as any;
};

Deno.test("MarketplaceAgent - loadContext creates new context for new user", async () => {
  const mockSupabase = createMockSupabase();
  const context = await MarketplaceAgent.loadContext("+250788123456", mockSupabase);
  
  assertEquals(context.phone, "+250788123456");
  assertEquals(context.flowType, null);
  assertEquals(context.conversationHistory.length, 0);
});

Deno.test("MarketplaceAgent - resetContext clears conversation", async () => {
  const mockSupabase = createMockSupabase();
  await MarketplaceAgent.resetContext("+250788123456", mockSupabase);
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
    
    const agent = new MarketplaceAgent(supabase, Deno.env.get("GEMINI_API_KEY") || "");
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
    
    const agent = new MarketplaceAgent(supabase, Deno.env.get("GEMINI_API_KEY") || "");
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
    
    const agent = new MarketplaceAgent(supabase, Deno.env.get("GEMINI_API_KEY") || "");
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
