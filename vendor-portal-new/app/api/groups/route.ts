import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const client = supabase as any;
  const auth = await getUserAndProfile();

  if (!auth) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { data: mySaccos, error: mySaccosError } = await client
    .from("user_saccos")
    .select("sacco_id")
    .eq("user_id", auth.user.id);

  if (mySaccosError) {
    return NextResponse.json({ error: mySaccosError.message }, { status: 500 });
  }

  const ids = (mySaccos ?? []).map((entry: { sacco_id: string }) => entry.sacco_id);

  if (ids.length === 0) {
    return NextResponse.json({ groups: [] });
  }

  const { data, error } = await client
    .from("ikimina")
    .select("id, name, sacco_id, created_at")
    .in("sacco_id", ids)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ groups: data ?? [] });
}
