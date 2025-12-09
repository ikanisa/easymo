import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "edge";

const transferSchema = z.object({
  from_member_id: z.string().uuid(),
  to_member_id: z.string().uuid(),
  amount: z.number().int().positive(),
  description: z.string().optional(),
  sacco_id: z.string().uuid(),
});

/**
 * POST /api/members/transfer
 * Transfer funds between member accounts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = transferSchema.parse(body);

    const supabase = await createClient();

    // Get current user for audit
    const { data: { user } } = await supabase.auth.getUser();

    // Verify both members belong to the same SACCO
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, full_name, sacco_id")
      .in("id", [params.from_member_id, params.to_member_id])
      .eq("sacco_id", params.sacco_id)
      .eq("status", "ACTIVE");

    if (membersError || !members || members.length !== 2) {
      return NextResponse.json(
        { error: "Invalid member IDs or members not in same SACCO" },
        { status: 400 }
      );
    }

    // Get sender's savings account
    const { data: fromAccount, error: fromError } = await supabase
      .from("accounts")
      .select("id, balance, account_type")
      .eq("member_id", params.from_member_id)
      .eq("account_type", "savings")
      .eq("status", "ACTIVE")
      .single();

    if (fromError || !fromAccount) {
      return NextResponse.json(
        { error: "Sender account not found" },
        { status: 404 }
      );
    }

    // Verify sufficient balance
    if (fromAccount.balance < params.amount) {
      return NextResponse.json(
        {
          error: "Insufficient balance",
          available: fromAccount.balance,
          requested: params.amount,
        },
        { status: 400 }
      );
    }

    // Get recipient's savings account
    const { data: toAccount, error: toError } = await supabase
      .from("accounts")
      .select("id, balance, account_type")
      .eq("member_id", params.to_member_id)
      .eq("account_type", "savings")
      .eq("status", "ACTIVE")
      .single();

    if (toError || !toAccount) {
      return NextResponse.json(
        { error: "Recipient account not found" },
        { status: 404 }
      );
    }

    // Create transfer transaction reference
    const transferRef = `TRF-${Date.now()}`;

    // Debit sender account
    const { error: debitError } = await supabase
      .from("accounts")
      .update({
        balance: fromAccount.balance - params.amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fromAccount.id);

    if (debitError) {
      console.error("Debit error:", debitError);
      return NextResponse.json(
        { error: "Failed to debit sender account" },
        { status: 500 }
      );
    }

    // Credit recipient account
    const { error: creditError } = await supabase
      .from("accounts")
      .update({
        balance: toAccount.balance + params.amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", toAccount.id);

    if (creditError) {
      console.error("Credit error:", creditError);

      // Rollback debit
      await supabase
        .from("accounts")
        .update({
          balance: fromAccount.balance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fromAccount.id);

      return NextResponse.json(
        { error: "Failed to credit recipient account" },
        { status: 500 }
      );
    }

    // Create ledger entries for audit trail
    const ledgerEntries = [
      {
        sacco_id: params.sacco_id,
        debit_id: fromAccount.id,
        amount: params.amount,
        value_date: new Date().toISOString(),
        description: params.description || `Transfer to ${members.find(m => m.id === params.to_member_id)?.full_name}`,
        reference: transferRef,
        created_at: new Date().toISOString(),
      },
      {
        sacco_id: params.sacco_id,
        credit_id: toAccount.id,
        amount: params.amount,
        value_date: new Date().toISOString(),
        description: params.description || `Transfer from ${members.find(m => m.id === params.from_member_id)?.full_name}`,
        reference: transferRef,
        created_at: new Date().toISOString(),
      },
    ];

    const { error: ledgerError } = await supabase
      .from("ledger_entries")
      .insert(ledgerEntries);

    if (ledgerError) {
      console.error("Ledger error:", ledgerError);
      // Note: Transfer already completed, this is just audit trail
    }

    return NextResponse.json({
      success: true,
      transfer_reference: transferRef,
      from: {
        member_id: params.from_member_id,
        previous_balance: fromAccount.balance,
        new_balance: fromAccount.balance - params.amount,
      },
      to: {
        member_id: params.to_member_id,
        previous_balance: toAccount.balance,
        new_balance: toAccount.balance + params.amount,
      },
      amount: params.amount,
      transferred_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Transfer API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
