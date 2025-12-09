import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const legacyClient = supabase as any;
  const auth = await getUserAndProfile();

  if (!auth) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { data, error } = await legacyClient
    .from("join_requests")
    .select("id, group_id, sacco_id, status, created_at, note")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ activity: [] });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { activity: data ?? [] },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=180",
      },
    }
  );
}
