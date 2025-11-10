import { NextResponse } from "next/server";
import { z } from "zod";
import { listAgentTools, type AgentTool } from "@/lib/supabase/server/tools";
import { SupabaseUnavailableError, SupabaseQueryError } from "@/lib/supabase/server/utils";

const querySchema = z.object({
  includeDisabled: z
    .string()
    .transform((value) => value === "true")
    .optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    includeDisabled: searchParams.get("includeDisabled") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  try {
    const tools = await listAgentTools({
      includeDisabled: parsed.data.includeDisabled ?? true,
    });
    return NextResponse.json<{ tools: AgentTool[] }>({ tools });
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
