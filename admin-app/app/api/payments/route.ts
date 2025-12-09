import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const listParamsSchema = z.object({
  saccoId: z.string().uuid(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(["pending", "completed", "failed", "reversed"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().min(1).optional(),
});

function mapPaymentRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    saccoId: row.sacco_id as string,
    memberId: row.member_id as string,
    smsInboxId: (row.sms_inbox_id as string | null) ?? null,
    amount: row.amount !== null && row.amount !== undefined ? Number(row.amount) : 0,
    currency: (row.currency as string) ?? "RWF",
    transactionId: (row.transaction_id as string | null) ?? null,
    provider: (row.provider as string | null) ?? null,
    paymentType: (row.payment_type as string) ?? "deposit",
    reference: (row.reference as string | null) ?? null,
    status: (row.status as string) ?? "pending",
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    // Member details from join
    memberNumber: (row.member_number as string | null) ?? null,
    memberFirstName: (row.member_first_name as string | null) ?? null,
    memberLastName: (row.member_last_name as string | null) ?? null,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listParamsSchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params", issues: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const { saccoId, limit, offset, status, startDate, endDate, search } = parsed.data;
  
  // Query payments with member details joined
  let query = admin
    .from("app.payments")
    .select(`
      *,
      members:member_id (
        member_number,
        first_name,
        last_name
      )
    `, { count: "exact" })
    .eq("sacco_id", saccoId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  if (startDate) {
    query = query.gte("created_at", startDate);
  }

  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  if (search) {
    // Search by transaction_id, reference, or member name
    query = query.or(`transaction_id.ilike.%${search}%,reference.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => {
    const member = (row.members as Record<string, unknown> | null);
    return mapPaymentRow({
      ...row,
      member_number: member?.member_number ?? null,
      member_first_name: member?.first_name ?? null,
      member_last_name: member?.last_name ?? null,
    });
  });
  
  const total = count ?? rows.length;
  const hasMore = offset + rows.length < total;

  return NextResponse.json({ data: rows, total, hasMore });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
