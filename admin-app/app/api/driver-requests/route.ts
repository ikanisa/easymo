import { NextResponse } from "next/server";
import { z } from "zod";

import {
  type AgentRequest,
  listAgentRequests,
} from "@/lib/supabase/server/requests";
import { SupabaseQueryError,SupabaseUnavailableError } from "@/lib/supabase/server/utils";

const querySchema = z.object({
  agentType: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    agentType: searchParams.get("agentType") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  try {
    const data = await listAgentRequests(parsed.data);
    return NextResponse.json<{ requests: AgentRequest[] }>({ requests: data });
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
