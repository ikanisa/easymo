/**
 * Double-entry ledger operations for payment processing
 *
 * This module implements double-entry bookkeeping for SACCO payments.
 * Each payment creates ledger entries that debit one account and credit another,
 * ensuring the books always balance (sum of debits = sum of credits).
 *
 * Account Types:
 * - MOMO_CLEARING: Temporary holding account for unverified mobile money receipts
 * - MOMO_SETTLEMENT: Verified mobile money receipts after reconciliation
 * - IKIMINA: Group savings accounts for each ikimina
 * - MEMBER: Individual member accounts (future use)
 *
 * Payment Lifecycle:
 * 1. Initial receipt: Debit MOMO_CLEARING, Credit IKIMINA (via postToLedger)
 * 2. After verification: Debit MOMO_SETTLEMENT, Credit MOMO_CLEARING (via settleLedger)
 *
 * @module ledger
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AnyClient = SupabaseClient<any, any, any>;

type Payment = {
  id: string;
  sacco_id: string;
  ikimina_id: string | null;
  member_id: string | null;
  amount: number;
  currency: string;
  txn_id: string;
};

/**
 * Ensure a ledger account exists, creating it if necessary
 *
 * Accounts are unique by (owner_type, owner_id, currency).
 * This function is idempotent - safe to call multiple times.
 *
 * @param supabase - Supabase client
 * @param ownerType - Type of account owner (MOMO_CLEARING, IKIMINA, MEMBER, etc.)
 * @param ownerId - UUID of the owner (sacco_id for clearing, ikimina_id for groups, etc.)
 * @param saccoId - UUID of the SACCO this account belongs to
 * @param currency - Currency code (default: RWF)
 * @returns Account ID (UUID)
 *
 * @example
 * const accountId = await ensureAccount(supabase, "IKIMINA", ikiminaId, saccoId);
 */
export const ensureAccount = async (
  supabase: AnyClient,
  ownerType: string,
  ownerId: string,
  saccoId: string,
  currency = "RWF"
) => {
  const { data, error } = await supabase
    .schema("app")
    .from("accounts")
    .select("id")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .eq("currency", currency)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.id) {
    return data.id as string;
  }

  const { data: created, error: createError } = await supabase
    .schema("app")
    .from("accounts")
    .insert({
      owner_type: ownerType,
      owner_id: ownerId,
      sacco_id: saccoId,
      currency,
      status: "ACTIVE",
    })
    .select("id")
    .single();

  if (createError) {
    throw createError;
  }

  return created.id as string;
};

/**
 * Post a payment to the ledger (initial receipt)
 *
 * Creates a double-entry ledger transaction:
 * - Debit: MOMO_CLEARING account (money received from mobile money)
 * - Credit: IKIMINA account (group savings increase)
 *
 * This function is idempotent based on payment.id - duplicate calls return existing entry.
 *
 * @param supabase - Supabase client
 * @param payment - Payment object with id, amounts, and allocation details
 * @returns Ledger entry ID
 * @throws Error if payment is not allocated to an ikimina
 *
 * @example
 * await postToLedger(supabase, {
 *   id: paymentId,
 *   sacco_id: saccoId,
 *   ikimina_id: ikiminaId,
 *   amount: 20000,
 *   currency: "RWF",
 *   txn_id: "TXN123"
 * });
 */
export const postToLedger = async (supabase: AnyClient, payment: Payment) => {
  if (!payment.ikimina_id) {
    throw new Error("Payment missing ikimina");
  }

  const clearingAccountId = await ensureAccount(
    supabase,
    "MOMO_CLEARING",
    payment.sacco_id,
    payment.sacco_id
  );
  const ikiminaAccountId = await ensureAccount(
    supabase,
    "IKIMINA",
    payment.ikimina_id,
    payment.sacco_id
  );

  // Check if already posted (idempotency)
  const { data: existing, error: fetchError } = await supabase
    .schema("app")
    .from("ledger_entries")
    .select("id")
    .eq("external_id", payment.id)
    .eq("memo", "POSTED")
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (existing?.id) {
    return existing.id as string;
  }

  const { data: entry, error: insertError } = await supabase
    .schema("app")
    .from("ledger_entries")
    .insert({
      sacco_id: payment.sacco_id,
      debit_id: clearingAccountId,
      credit_id: ikiminaAccountId,
      amount: payment.amount,
      currency: payment.currency,
      value_date: new Date().toISOString(),
      external_id: payment.id,
      memo: "POSTED",
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  return entry.id as string;
};

/**
 * Settle a payment in the ledger (after verification)
 *
 * Creates a second ledger entry to move funds from clearing to settlement:
 * - Debit: MOMO_SETTLEMENT account (verified funds)
 * - Credit: MOMO_CLEARING account (reduce pending verification)
 *
 * This is called after verifying the payment against mobile money statements.
 * This function is idempotent - safe to call multiple times for the same payment.
 *
 * @param supabase - Supabase client
 * @param payment - Payment object
 * @returns Ledger entry ID
 *
 * @example
 * await settleLedger(supabase, payment);
 */
export const settleLedger = async (supabase: AnyClient, payment: Payment) => {
  const clearingAccountId = await ensureAccount(
    supabase,
    "MOMO_CLEARING",
    payment.sacco_id,
    payment.sacco_id
  );
  const settlementAccountId = await ensureAccount(
    supabase,
    "MOMO_SETTLEMENT",
    payment.sacco_id,
    payment.sacco_id
  );

  // Check if already settled (idempotency)
  const { data: existing, error: fetchError } = await supabase
    .schema("app")
    .from("ledger_entries")
    .select("id")
    .eq("external_id", payment.id)
    .eq("memo", "SETTLED")
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (existing?.id) {
    return existing.id as string;
  }

  const { data: entry, error: insertError } = await supabase
    .schema("app")
    .from("ledger_entries")
    .insert({
      sacco_id: payment.sacco_id,
      debit_id: settlementAccountId,
      credit_id: clearingAccountId,
      amount: payment.amount,
      currency: payment.currency,
      value_date: new Date().toISOString(),
      external_id: payment.id,
      memo: "SETTLED",
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  return entry.id as string;
};

/**
 * Get the current balance of a ledger account
 *
 * Balance = Sum of credits - Sum of debits
 *
 * @param supabase - Supabase client
 * @param accountId - Account UUID
 * @returns Current balance as a number
 *
 * @example
 * const balance = await getAccountBalance(supabase, ikiminaAccountId);
 * console.log(`Group has ${balance} RWF`);
 */
export const getAccountBalance = async (supabase: AnyClient, accountId: string) => {
  const { data, error } = await supabase.rpc("account_balance", {
    account_id: accountId,
  });

  if (error) {
    throw error;
  }

  return Number(data ?? 0);
};
