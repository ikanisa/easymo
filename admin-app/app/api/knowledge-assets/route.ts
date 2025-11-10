import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listKnowledgeAssets,
  type KnowledgeAsset,
} from "@/lib/supabase/server/knowledge";
import { SupabaseUnavailableError, SupabaseQueryError } from "@/lib/supabase/server/utils";

const querySchema = z.object({
  agentId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    agentId: searchParams.get("agentId") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  try {
    const assets = await listKnowledgeAssets(parsed.data.agentId);
    return NextResponse.json<{ assets: KnowledgeAsset[] }>({ assets });
  } catch (error) {
    if (error instanceof SupabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof SupabaseQueryError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "unknown_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
