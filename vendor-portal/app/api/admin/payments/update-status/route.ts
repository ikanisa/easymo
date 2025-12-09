import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { canReconcilePayments, isSystemAdmin } from "@/lib/permissions";

const payloadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: z.string().min(1),
  saccoId: z.string().uuid().nullish(),
});

export async function POST(request: NextRequest) {
  const auth = await requireUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { ids, status, saccoId } = parsed.data;
  const userProfile = auth.profile;
  const supabase = createSupabaseServiceRoleClient("admin/payments/update-status");

  if (!isSystemAdmin(userProfile)) {
    const allowedSacco = saccoId ?? userProfile.sacco_id ?? null;
    if (!allowedSacco || !canReconcilePayments(userProfile, allowedSacco)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let query = supabase.schema("app").from("payments").update({ status }).in("id", ids).select("id");

  if (!isSystemAdmin(userProfile)) {
    if (!userProfile.sacco_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    query = query.eq("sacco_id", userProfile.sacco_id);
  } else if (saccoId) {
    query = query.eq("sacco_id", saccoId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to update payments" },
      { status: 500 }
    );
  }

  return NextResponse.json({ updated: data?.length ?? 0 });
}
