import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const paramsSchema = z.object({
  id: z.string().min(1),
});

const bodySchema = z.object({
  status: z.string().min(1),
  reviewerComment: z.string().nullable().optional(),
});

function mapRow(row: Record<string, any>) {
  return {
    id: row.id as string,
    status: (row.status as string | null) ?? "pending",
    reviewerComment: (row.reviewer_comment as string | null | undefined) ?? null,
    approvedAt: (row.approved_at as string | null | undefined) ?? null,
    updatedAt: (row.updated_at as string | null | undefined) ?? null,
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_unavailable" }, { status: 503 });
  }

  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "invalid_params", issues: parsedParams.error.flatten() }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_payload", issues: parsedBody.error.flatten() }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {
    status: parsedBody.data.status,
    reviewer_comment: parsedBody.data.reviewerComment ?? null,
  };

  if (parsedBody.data.status === "approved") {
    updatePayload.approved_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from("insurance_quotes")
    .update(updatePayload)
    .eq("id", parsedParams.data.id)
    .select("id, status, reviewer_comment, approved_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ data: mapRow(data) });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
