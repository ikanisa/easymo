import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/observability/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json(
      { results: [] },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } }
    );
  }

  const supabase = createSupabaseAdminClient();

  const rpcArgs: Database["public"]["Functions"]["search_saccos"]["Args"] = {
    query: q,
    limit_count: 10,
  };

  const { data, error } = await supabase.rpc("search_saccos", rpcArgs as never);

  if (error) {
    logError("Failed to search SACCOs", error);
    return NextResponse.json(
      { results: [] },
      {
        status: 500,
        headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
      }
    );
  }

  const rows = (data ?? []) as Database["public"]["Functions"]["search_saccos"]["Returns"];

  const results = rows.map((row) => ({
    id: row.id,
    name: row.name,
    district: row.district,
    sector_code: row.sector,
  }));

  return NextResponse.json(
    { results },
    {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
    }
  );
}
