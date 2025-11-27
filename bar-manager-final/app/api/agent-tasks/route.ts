import { NextResponse } from "next/server";
import { z } from "zod";

import { type AgentTask,listAgentTasks } from "@/lib/supabase/server/tasks";
import { SupabaseQueryError,SupabaseUnavailableError } from "@/lib/supabase/server/utils";

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
    const tasks = await listAgentTasks(parsed.data.agentId);
    return NextResponse.json<{ tasks: AgentTask[] }>({ tasks });
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
