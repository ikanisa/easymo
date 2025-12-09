import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { onboardingPayloadSchema, upsertMemberOnboardingProfile } from "@/lib/member/onboarding";
import { logError } from "@/lib/observability/logger";

const syncSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        payload: onboardingPayloadSchema,
      })
    )
    .default([]),
});

type SyncResult = {
  id: string;
  status: "success" | "error";
  error?: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const legacyClient = supabase as any;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    logError("member.onboarding.sync_auth_failed", authError);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    const json = await request.json();
    parsed = syncSchema.safeParse(json);
  } catch (error) {
    logError("member.onboarding.sync_parse_failed", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { items } = parsed.data;

  if (items.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const results: SyncResult[] = [];

  for (const item of items) {
    const result = await upsertMemberOnboardingProfile(legacyClient, user.id, item.payload);

    if (result.success) {
      results.push({ id: item.id, status: "success" });
    } else {
      results.push({ id: item.id, status: "error", error: result.error });
    }
  }

  const hasFailure = results.some((entry) => entry.status === "error");

  return NextResponse.json(
    { results },
    {
      status: hasFailure ? 207 : 200,
    }
  );
}
