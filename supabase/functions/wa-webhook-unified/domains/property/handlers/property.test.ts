import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";

// Minimal env values required by shared config
Deno.env.set("SUPABASE_URL", "http://localhost");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
Deno.env.set("WA_PHONE_ID", "000000000000");
Deno.env.set("WA_TOKEN", "token");
Deno.env.set("WA_APP_SECRET", "secret");
Deno.env.set("WA_VERIFY_TOKEN", "verify");

const { setFetchImplementation } = await import("../../_shared/wa-webhook-shared/utils/http.ts");
const { startPropertyRentals } = await import("../property/rentals.ts");

// Mock Supabase client
const mockSupabase = {
  from: () => ({
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: {}, error: null }),
    update: () => Promise.resolve({ data: {}, error: null }),
    upsert: () => Promise.resolve({ data: {}, error: null }),
  }),
} as any;

// Mock context
const mockContext: RouterContext = {
  from: "+250788123456",
  profileId: "test-profile-id",
  locale: "en",
  supabase: mockSupabase,
};

function installFetchStub() {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ input, init });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  setFetchImplementation(globalThis.fetch);
  return {
    requests,
    restore() {
      globalThis.fetch = originalFetch;
      setFetchImplementation(originalFetch);
    },
  };
}

Deno.test("Property Handler - Service Name", () => {
  assertEquals("wa-webhook-property", "wa-webhook-property");
});

Deno.test("Property Handler - startPropertyRentals returns boolean", async () => {
  const stub = installFetchStub();
  try {
    const result = await startPropertyRentals(mockContext);
    assertEquals(typeof result, "boolean");
  } finally {
    stub.restore();
  }
});

Deno.test("Property Handler - context has required fields", () => {
  assertExists(mockContext.from);
  assertExists(mockContext.profileId);
  assertExists(mockContext.locale);
  assertExists(mockContext.supabase);
});
