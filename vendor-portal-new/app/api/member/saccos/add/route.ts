import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/observability/logger";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const addSchema = z.object({ saccoId: z.string().uuid("Invalid SACCO id") });

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  // Member app tables are optional; treat as dynamic

  const legacyClient = supabase as any;
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    logError("Failed to validate auth", authError);
    return NextResponse.json({ error: "Auth failure" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const payload = addSchema.safeParse(json);

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  const { saccoId } = payload.data;

  const insertPayload = {
    user_id: user.id,
    sacco_id: saccoId,
  };

  const { error } = await legacyClient
    .from("user_saccos")
    .upsert(insertPayload, { onConflict: "user_id,sacco_id" });

  if (error) {
    logError("Failed to add SACCO", error);
    return NextResponse.json({ error: "Unable to add SACCO" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
