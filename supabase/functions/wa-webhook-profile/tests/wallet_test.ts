import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  assertSpyCalls,
  spy,
} from "https://deno.land/std@0.168.0/testing/mock.ts";
import { confirmPurchase } from "../wallet/purchase.ts";

Deno.test("confirmPurchase - success flow", async () => {
  const mockPurchase = {
    id: "p123",
    status: "pending",
    user_id: "user-123",
    token_amount: 1000,
    user_wa_id: "250788888888",
  };

  const mockSupabase = {
    from: (table: string) => {
      if (table === "wallet_purchases") {
        return {
          select: () => ({
            eq: (col: string, val: any) => ({
              single: () =>
                Promise.resolve({ data: mockPurchase, error: null }),
            }),
          }),
          update: (data: any) => ({
            eq: (col: string, val: any) =>
              Promise.resolve({ data: null, error: null }),
          }),
        };
      }
      return {};
    },
    rpc: (func: string, args: any) =>
      Promise.resolve({ data: null, error: null }),
  };

  const rpcSpy = spy(mockSupabase, "rpc");
  const notifierSpy = spy(async (to: string, body: string) => {});

  const result = await confirmPurchase(
    mockSupabase,
    "p123",
    "momo-tx-123",
    notifierSpy,
  );

  assertEquals(result, true);
  assertSpyCalls(rpcSpy, 1);
  assertSpyCalls(notifierSpy, 1);

  // Check RPC arguments
  assertEquals(rpcSpy.calls[0].args[0], "wallet_credit_tokens");
  assertEquals(rpcSpy.calls[0].args[1], {
    p_user_id: "user-123",
    p_amount: 1000,
    p_reference_type: "purchase",
    p_reference_id: "p123",
    p_description: "Purchased 1,000 tokens",
  });
});

Deno.test("confirmPurchase - fail if not pending", async () => {
  const mockPurchase = {
    id: "p123",
    status: "completed", // Already completed
    user_id: "user-123",
    token_amount: 1000,
    user_wa_id: "250788888888",
  };

  const mockSupabase = {
    from: (table: string) => {
      if (table === "wallet_purchases") {
        return {
          select: () => ({
            eq: (col: string, val: any) => ({
              single: () =>
                Promise.resolve({ data: mockPurchase, error: null }),
            }),
          }),
        };
      }
      return {};
    },
  };

  const notifierSpy = spy(async (to: string, body: string) => {});

  const result = await confirmPurchase(
    mockSupabase,
    "p123",
    "momo-tx-123",
    notifierSpy,
  );

  assertEquals(result, false);
  assertSpyCalls(notifierSpy, 0);
});
