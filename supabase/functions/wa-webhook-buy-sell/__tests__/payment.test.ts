/**
 * Payment System Tests
 * 
 * Tests for USSD-based MoMo payment integration
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  initiatePayment,
  buyerConfirmPayment,
  sellerConfirmPayment,
  cancelTransaction,
} from "../payment.ts";

// Mock Supabase client
const createMockSupabase = () => {
  const mockData: Record<string, any> = {
    listings: [],
    transactions: [],
  };

  return {
    from: (table: string) => ({
      select: (fields?: string) => ({
        eq: (field: string, value: any) => ({
          single: async () => {
            if (table === "marketplace_listings") {
              return {
                data: mockData.listings.find((l: any) => l[field] === value),
                error: null,
              };
            }
            if (table === "marketplace_transactions") {
              return {
                data: mockData.transactions.find((t: any) => t[field] === value),
                error: null,
              };
            }
            return { data: null, error: null };
          },
        }),
      }),
      insert: async (data: any) => {
        const id = crypto.randomUUID();
        const record = { ...data, id };
        if (table === "marketplace_transactions") {
          mockData.transactions.push(record);
        }
        return {
          select: () => ({
            single: async () => ({ data: record, error: null }),
          }),
        };
      },
      update: (data: any) => ({
        eq: (field: string, value: any) => ({
          error: null,
        }),
      }),
    }),
    rpc: async (fn: string, params: any) => {
      if (fn === "get_active_transactions") {
        return {
          data: mockData.transactions.filter(
            (t: any) =>
              (t.buyer_phone === params.p_phone || t.seller_phone === params.p_phone) &&
              ["initiated", "pending", "confirming"].includes(t.status)
          ),
          error: null,
        };
      }
      return { data: null, error: null };
    },
  } as any;
};

Deno.test("initiatePayment - generates correct USSD code", async () => {
  const supabase = createMockSupabase();
  
  // Setup mock listing
  (supabase as any).from("marketplace_listings").select = () => ({
    eq: () => ({
      single: async () => ({
        data: {
          id: "listing-123",
          title: "iPhone 12",
          price: 500000,
          seller_phone: "+250788999999",
          status: "active",
          in_transaction: false,
        },
        error: null,
      }),
    }),
  });

  // Mock environment
  Deno.env.set("MOMO_MERCHANT_CODE", "123456");

  const result = await initiatePayment(
    supabase,
    "+250788123456",
    "listing-123",
    500000
  );

  assertExists(result);
  assertEquals(result.ussd_tel_link, "tel:*182*8*1*123456*500000#");
  assertEquals(result.ussd_display_text, "*182*8*1*123456*500000#");
  assertExists(result.transaction_id);
  assertExists(result.message_to_buyer);
  assertExists(result.message_to_seller);
});

Deno.test("initiatePayment - prevents self-purchase", async () => {
  const supabase = createMockSupabase();
  
  (supabase as any).from("marketplace_listings").select = () => ({
    eq: () => ({
      single: async () => ({
        data: {
          id: "listing-123",
          seller_phone: "+250788123456",
          price: 500000,
          status: "active",
        },
        error: null,
      }),
    }),
  });

  try {
    await initiatePayment(supabase, "+250788123456", "listing-123");
    throw new Error("Should have thrown error");
  } catch (error) {
    assertEquals(
      (error as Error).message,
      "You cannot buy your own listing"
    );
  }
});

Deno.test("buyerConfirmPayment - updates status to confirming", async () => {
  const supabase = createMockSupabase();
  const transactionId = "tx-123";

  (supabase as any).from("marketplace_transactions").select = () => ({
    eq: () => ({
      single: async () => ({
        data: {
          id: transactionId,
          buyer_phone: "+250788123456",
          seller_phone: "+250788999999",
          status: "initiated",
          agreed_price: 500000,
          marketplace_listings: {
            title: "iPhone 12",
            seller_phone: "+250788999999",
          },
        },
        error: null,
      }),
    }),
  });

  const result = await buyerConfirmPayment(
    supabase,
    transactionId,
    "+250788123456",
    "MTN-REF-12345"
  );

  assertEquals(result.success, true);
  assertEquals(result.transaction_status, "confirming");
  assertEquals(result.message.includes("confirmation received"), true);
});

Deno.test("sellerConfirmPayment - completes transaction", async () => {
  const supabase = createMockSupabase();
  const transactionId = "tx-123";

  (supabase as any).from("marketplace_transactions").select = () => ({
    eq: () => ({
      single: async () => ({
        data: {
          id: transactionId,
          buyer_phone: "+250788123456",
          seller_phone: "+250788999999",
          status: "confirming",
          agreed_price: 500000,
          listing_id: "listing-123",
          marketplace_listings: {
            id: "listing-123",
            title: "iPhone 12",
          },
        },
        error: null,
      }),
    }),
  });

  const result = await sellerConfirmPayment(
    supabase,
    transactionId,
    "+250788999999"
  );

  assertEquals(result.success, true);
  assertEquals(result.transaction_status, "completed");
  assertEquals(result.message.includes("completed"), true);
});

Deno.test("cancelTransaction - allows buyer to cancel", async () => {
  const supabase = createMockSupabase();
  const transactionId = "tx-123";

  (supabase as any).from("marketplace_transactions").select = () => ({
    or: () => ({
      single: async () => ({
        data: {
          id: transactionId,
          buyer_phone: "+250788123456",
          seller_phone: "+250788999999",
          status: "initiated",
          listing_id: "listing-123",
        },
        error: null,
      }),
    }),
  });

  const result = await cancelTransaction(
    supabase,
    transactionId,
    "+250788123456",
    "Changed my mind"
  );

  assertEquals(result.success, true);
  assertEquals(result.message.includes("cancelled"), true);
});

Deno.test("USSD code format validation", () => {
  // Test USSD structure for Rwanda
  const merchantCode = "123456";
  const amount = 50000;
  const expected = "*182*8*1*123456*50000#";
  
  const ussdCode = `*182*8*1*${merchantCode}*${amount}#`;
  assertEquals(ussdCode, expected);
  
  // Test tel: link format
  const telLink = `tel:${ussdCode}`;
  assertEquals(telLink, "tel:*182*8*1*123456*50000#");
});
