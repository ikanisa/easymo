import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/observability/logger";
import { z } from "zod";

import { createFeatureFlagAdmin } from "@ibimina/flags";

import { AdminPermissionError, requireAdminContext } from "@/lib/admin/guard";

const changeSchema = z
  .object({
    key: z.string().min(1),
    scope: z.enum(["global", "country", "partner"]),
    targetId: z.string().uuid().optional(),
    value: z.boolean().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.scope !== "global" && !value.targetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `targetId is required for ${value.scope} changes`,
        path: ["targetId"],
      });
    }
  });

const postSchema = z.object({
  changes: z.array(changeSchema).min(1),
});

const parseKeys = (request: NextRequest): string[] => {
  const url = new URL(request.url);
  const keys = url.searchParams.getAll("keys");
  return keys
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export async function GET(request: NextRequest) {
  try {
    const keys = parseKeys(request);
    const { supabase } = await requireAdminContext({
      action: "feature_flags_snapshot",
      reason: "Feature flag snapshot requires admin access",
      metadata: { requestedKeyCount: keys.length },
    });
    const admin = createFeatureFlagAdmin(supabase);
    const snapshot = await admin.loadSnapshot(keys.length ? keys : undefined);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof AdminPermissionError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError("[feature-flags] Failed to load snapshot", error);
    return NextResponse.json({ error: "Failed to load feature flags" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = postSchema.parse(payload);
    const { supabase, user } = await requireAdminContext({
      action: "feature_flags_update",
      reason: "Feature flag updates require admin access",
      metadata: { changeCount: parsed.changes.length },
    });
    const admin = createFeatureFlagAdmin(supabase);

    await admin.applyChanges(
      parsed.changes.map((change) => ({
        ...change,
        actorId: user.id,
      }))
    );

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }

    if (error instanceof AdminPermissionError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    logError("[feature-flags] Failed to apply changes", error);
    return NextResponse.json({ error: "Failed to update feature flags" }, { status: 500 });
  }
}
