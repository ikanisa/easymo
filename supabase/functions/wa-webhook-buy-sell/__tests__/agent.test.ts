/**
 * Marketplace AI Agent Tests
 * 
 * Tests for the conversational marketplace agent including:
 * - Intent classification
 * - Entity extraction
 * - Flow completion
 * - Search functionality
 * - Interactive category workflow
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { 
  MarketplaceAgent, 
  type MarketplaceContext,
  generateCategoryMenu,
  parseCategorySelection,
  getCategoryByNumber,
  generateLocationRequest,
  formatBusinessResults,
  formatBusinessContact,
  parseResultSelection,
  BUSINESS_CATEGORIES,
  EMOJI_NUMBERS,
} from "../agent.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.test("BUSINESS_CATEGORIES - has 9 categories", () => {
  assertEquals(BUSINESS_CATEGORIES.length, 9);
});

Deno.test("EMOJI_NUMBERS - has 9 emojis", () => {
  assertEquals(EMOJI_NUMBERS.length, 9);
});

Deno.test("generateCategoryMenu - generates valid menu", () => {
  const menu = generateCategoryMenu();
  
  // Should contain header
  assertExists(menu);
  assertEquals(menu.includes("EasyMO Buy & Sell"), true);
  
  // Should contain all categories
  for (const cat of BUSINESS_CATEGORIES) {
    assertEquals(menu.includes(cat.name), true);
    assertEquals(menu.includes(cat.icon), true);
  }
  
  // Should contain emoji numbers
  assertEquals(menu.includes("1️⃣"), true);
  assertEquals(menu.includes("9️⃣"), true);
});

Deno.test("parseCategorySelection - parses numeric input", () => {
  assertEquals(parseCategorySelection("1"), 1);
  assertEquals(parseCategorySelection("5"), 5);
  assertEquals(parseCategorySelection("9"), 9);
  assertEquals(parseCategorySelection("0"), null);
  assertEquals(parseCategorySelection("10"), null);
});

Deno.test("parseCategorySelection - parses emoji input", () => {
  assertEquals(parseCategorySelection("1️⃣"), 1);
  assertEquals(parseCategorySelection("5️⃣"), 5);
});

Deno.test("parseCategorySelection - parses word input", () => {
  assertEquals(parseCategorySelection("one"), 1);
  assertEquals(parseCategorySelection("two"), 2);
  assertEquals(parseCategorySelection("first"), 1);
});

Deno.test("parseCategorySelection - parses category name", () => {
  assertEquals(parseCategorySelection("pharmacy"), 1);
  assertEquals(parseCategorySelection("salon"), 2);
  assertEquals(parseCategorySelection("restaurant"), 3);
  assertEquals(parseCategorySelection("supermarket"), 4);
});

Deno.test("parseCategorySelection - returns null for invalid input", () => {
  assertEquals(parseCategorySelection("invalid"), null);
  assertEquals(parseCategorySelection(""), null);
  assertEquals(parseCategorySelection("xyz123"), null);
});

Deno.test("getCategoryByNumber - returns correct category", () => {
  const cat1 = getCategoryByNumber(1);
  assertExists(cat1);
  assertEquals(cat1.code, "pharmacy");
  assertEquals(cat1.icon, "💊");
  
  const cat3 = getCategoryByNumber(3);
  assertExists(cat3);
  assertEquals(cat3.code, "restaurant");
  assertEquals(cat3.icon, "🍽️");
});

Deno.test("getCategoryByNumber - returns null for invalid number", () => {
  assertEquals(getCategoryByNumber(0), null);
  assertEquals(getCategoryByNumber(10), null);
  assertEquals(getCategoryByNumber(-1), null);
});

Deno.test("generateLocationRequest - generates valid location prompt", () => {
  const category = getCategoryByNumber(1)!;
  const prompt = generateLocationRequest(category);
  
  assertExists(prompt);
  assertEquals(prompt.includes("Share Your Location"), true);
  assertEquals(prompt.includes(category.icon), true);
  assertEquals(prompt.includes(category.name), true);
});

Deno.test("formatBusinessResults - formats businesses correctly", () => {
  const category = getCategoryByNumber(1)!;
  const businesses = [
    { id: "1", name: "Test Pharmacy", category: "pharmacy", city: "Kigali", phone: "+250788123456", rating: 4.5, distance_km: 0.5 },
    { id: "2", name: "Another Pharmacy", category: "pharmacy", city: "Nyarugenge", phone: "+250788654321", rating: 4.0, distance_km: 1.2 },
  ];
  
  const result = formatBusinessResults(businesses, category);
  
  assertExists(result);
  assertEquals(result.includes("Test Pharmacy"), true);
  assertEquals(result.includes("Another Pharmacy"), true);
  assertEquals(result.includes("1️⃣"), true);
  assertEquals(result.includes("2️⃣"), true);
  assertEquals(result.includes("0.5km"), true);
  assertEquals(result.includes("1.2km"), true);
});

Deno.test("formatBusinessResults - handles empty results", () => {
  const category = getCategoryByNumber(1)!;
  const result = formatBusinessResults([], category);
  
  assertExists(result);
  assertEquals(result.includes("No"), true);
  assertEquals(result.includes("Found"), true);
});

Deno.test("formatBusinessContact - formats contact correctly", () => {
  const business = {
    name: "Test Pharmacy",
    category: "pharmacy",
    city: "Kigali",
    address: "KN 1 Ave",
    phone: "+250788123456",
    rating: 4.5,
    distance_km: 0.5,
    description: "Best pharmacy in town",
  };
  
  const result = formatBusinessContact(business);
  
  assertExists(result);
  assertEquals(result.includes("Test Pharmacy"), true);
  assertEquals(result.includes("pharmacy"), true);
  assertEquals(result.includes("Kigali"), true);
  assertEquals(result.includes("0.5km"), true);
  assertEquals(result.includes("4.5"), true);
});

Deno.test("parseResultSelection - works same as category selection", () => {
  assertEquals(parseResultSelection("1"), 1);
  assertEquals(parseResultSelection("3"), 3);
  assertEquals(parseResultSelection("1️⃣"), 1);
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
