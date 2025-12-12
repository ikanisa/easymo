import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";

// Mock Supabase client for testing
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "http://localhost:54321",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "test-key"
);

describe("Profile Edit", () => {
  let testUserId: string;
  let testCtx: RouterContext;

  beforeEach(async () => {
    // Create test user
    const { data: profile } = await supabase
      .from("profiles")
      .insert({ wa_id: "+250788000001", name: "Test User", language: "en" })
      .select()
      .single();
    
    testUserId = profile?.user_id;
    testCtx = {
      supabase,
      from: "+250788000001",
      profileId: testUserId,
      locale: "en"
    };
  });

  afterEach(async () => {
    // Cleanup
    if (testUserId) {
      await supabase.from("profiles").delete().eq("user_id", testUserId);
    }
  });

  it("should update user name", async () => {
    const { handleEditName } = await import("../profile/edit.ts");
    
    const result = await handleEditName(testCtx, "New Test Name");
    expect(result).toBe(true);

    const { data } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", testUserId)
      .single();

    expect(data?.name).toBe("New Test Name");
  });

  it("should reject name that is too short", async () => {
    const { handleEditName } = await import("../profile/edit.ts");
    
    const result = await handleEditName(testCtx, "A");
    expect(result).toBe(true); // Returns true but doesn't update

    const { data } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", testUserId)
      .single();

    expect(data?.name).toBe("Test User"); // Original name unchanged
  });

  it("should update user language", async () => {
    const { handleEditLanguage } = await import("../profile/edit.ts");
    
    const result = await handleEditLanguage(testCtx, "fr");
    expect(result).toBe(true);

    const { data } = await supabase
      .from("profiles")
      .select("language")
      .eq("user_id", testUserId)
      .single();

    expect(data?.language).toBe("fr");
  });

  it("should reject invalid language code", async () => {
    const { handleEditLanguage } = await import("../profile/edit.ts");
    
    const result = await handleEditLanguage(testCtx, "invalid");
    expect(result).toBe(false);

    const { data } = await supabase
      .from("profiles")
      .select("language")
      .eq("user_id", testUserId)
      .single();

    expect(data?.language).toBe("en"); // Original language unchanged
  });
});

describe("Transfer Security", () => {
  let testUserId: string;
  let testCtx: RouterContext;

  beforeEach(async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .insert({ wa_id: "+250788000002", name: "Security Test" })
      .select()
      .single();
    
    testUserId = profile?.user_id;
    testCtx = {
      supabase,
      from: "+250788000002",
      profileId: testUserId,
      locale: "en"
    };

    // Create wallet with balance
    await supabase.from("wallets").insert({
      user_id: testUserId,
      balance: 100000
    });
  });

  afterEach(async () => {
    if (testUserId) {
      await supabase.from("wallets").delete().eq("user_id", testUserId);
      await supabase.from("profiles").delete().eq("user_id", testUserId);
    }
  });

  it("should reject transfer below minimum", async () => {
    const { validateTransfer } = await import("../wallet/security.ts");
    
    const result = await validateTransfer(testCtx, 5, testUserId);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("amount_too_small");
  });

  it("should reject transfer above maximum", async () => {
    const { validateTransfer } = await import("../wallet/security.ts");
    
    const result = await validateTransfer(testCtx, 60000, testUserId);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("amount_too_large");
  });

  it("should require confirmation for large transfers", async () => {
    const { validateTransfer } = await import("../wallet/security.ts");
    
    const result = await validateTransfer(testCtx, 15000, testUserId);
    expect(result.valid).toBe(true);
    expect(result.requiresConfirmation).toBe(true);
  });

  it("should allow normal transfers", async () => {
    const { validateTransfer } = await import("../wallet/security.ts");
    
    const result = await validateTransfer(testCtx, 500, testUserId);
    expect(result.valid).toBe(true);
    expect(result.requiresConfirmation).toBe(false);
  });
});

describe("Wallet RPC Functions", () => {
  let testUserId: string;

  beforeEach(async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .insert({ wa_id: "+250788000003", name: "RPC Test" })
      .select()
      .single();
    
    testUserId = profile?.user_id;
  });

  afterEach(async () => {
    if (testUserId) {
      await supabase.from("wallet_transactions").delete().eq("user_id", testUserId);
      await supabase.from("wallets").delete().eq("user_id", testUserId);
      await supabase.from("profiles").delete().eq("user_id", testUserId);
    }
  });

  it("should credit tokens to wallet", async () => {
    const { data, error } = await supabase.rpc("wallet_credit_tokens", {
      p_user_id: testUserId,
      p_amount: 1000,
      p_reference_type: "test",
      p_reference_id: crypto.randomUUID(),
      p_description: "Test credit"
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data[0]?.success).toBe(true);
    expect(data[0]?.new_balance).toBe(1000);
  });

  it("should debit tokens from wallet", async () => {
    // First credit some tokens
    await supabase.rpc("wallet_credit_tokens", {
      p_user_id: testUserId,
      p_amount: 5000,
      p_reference_type: "test",
      p_reference_id: crypto.randomUUID()
    });

    // Then debit
    const { data, error } = await supabase.rpc("wallet_debit_tokens", {
      p_user_id: testUserId,
      p_amount: 1000,
      p_reference_type: "test",
      p_reference_id: crypto.randomUUID(),
      p_description: "Test debit"
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data[0]?.success).toBe(true);
    expect(data[0]?.new_balance).toBe(4000);
  });

  it("should reject debit with insufficient balance", async () => {
    const { data, error } = await supabase.rpc("wallet_debit_tokens", {
      p_user_id: testUserId,
      p_amount: 1000,
      p_reference_type: "test",
      p_reference_id: crypto.randomUUID()
    });

    expect(data[0]?.success).toBe(false);
    expect(data[0]?.error_code).toBe("insufficient_balance");
  });

  it("should create transaction records", async () => {
    await supabase.rpc("wallet_credit_tokens", {
      p_user_id: testUserId,
      p_amount: 500,
      p_reference_type: "test_credit",
      p_reference_id: crypto.randomUUID()
    });

    const { data: transactions } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", testUserId);

    expect(transactions?.length).toBeGreaterThan(0);
    expect(transactions?.[0]?.amount).toBe(500);
    expect(transactions?.[0]?.type).toBe("credit");
  });
});
