import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getNegotiationThread,
  type NegotiationThread,
} from "@/lib/supabase/server/negotiations";
import { SupabaseUnavailableError, SupabaseQueryError } from "@/lib/supabase/server/utils";

const paramsSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function GET(
  _request: Request,
  context: { params: { sessionId: string } },
) {
  const parsed = paramsSchema.safeParse(context.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  try {
    const thread = await getNegotiationThread(parsed.data.sessionId);
    if (!thread) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json<{ thread: NegotiationThread }>({ thread });
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
