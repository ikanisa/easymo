import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient();

  const client = supabase as any;
  const auth = await getUserAndProfile();

  if (!auth) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const gid = ctx.params.id;

  const { data: group, error: groupError } = await client
    .from("ikimina")
    .select("id, name, sacco_id, created_at")
    .eq("id", gid)
    .maybeSingle();

  if (groupError) {
    return NextResponse.json({ error: groupError.message }, { status: 500 });
  }

  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: totalData, error: totalError } = await client.rpc("sum_group_deposits", { gid });

  if (totalError && !["42883", "PGRST301"].includes(totalError.code ?? "")) {
    return NextResponse.json({ error: totalError.message }, { status: 500 });
  }

  const depositsSummary =
    totalData && typeof totalData === "object" ? (totalData as Record<string, unknown>) : null;
  const depositsAmount = Number(depositsSummary?.amount ?? NaN);
  const deposits = Number.isFinite(depositsAmount) ? depositsAmount : null;
  const depositsCurrency = depositsSummary?.currency ?? null;

  const { count, error: countError } = await client
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("ikimina_id", gid);

  if (countError) {
    const status = countError.code === "42501" ? 403 : 500;

    return NextResponse.json({ error: countError.message }, { status });
  }

  return NextResponse.json({
    group,
    totals: { deposits, currency: depositsCurrency },
    members_count: count ?? null,
  });
}
