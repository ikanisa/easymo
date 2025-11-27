import { NextRequest, NextResponse } from "next/server";

import { runOmniSearch } from "@/lib/omnisearch/search";
import { fetchOmniSearchSuggestions } from "@/lib/omnisearch/suggestions";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase server credentials are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 },
    );
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    if (!query) {
      const suggestions = await fetchOmniSearchSuggestions(supabase, {
        limitPerCategory: 5,
      });
      return NextResponse.json({ query, results: [], suggestions });
    }

    const [results, suggestions] = await Promise.all([
      runOmniSearch(supabase, query, { limitPerCategory: 8 }),
      fetchOmniSearchSuggestions(supabase, {
        limitPerCategory: 5,
        query,
      }),
    ]);

    return NextResponse.json({ query, results, suggestions });
  } catch (error) {
    console.error("api.omnisearch.failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error while running search" },
      { status: 500 },
    );
  }
}
