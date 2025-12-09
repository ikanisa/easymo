import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { isSystemAdmin } from "@/lib/permissions";

const payloadSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  brandColor: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

type RouteParams = {
  params: { saccoId: string };
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const saccoId = params.saccoId;
  if (!saccoId) {
    return NextResponse.json({ error: "Missing saccoId" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { logoUrl, brandColor } = parsed.data;
  if (logoUrl === undefined && brandColor === undefined) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const profile = auth.profile;
  if (!isSystemAdmin(profile) && profile.sacco_id !== saccoId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseServiceRoleClient("admin/saccos/branding");
  const { data: existing, error: fetchError } = await supabase
    .schema("app")
    .from("saccos")
    .select("metadata, logo_url")
    .eq("id", saccoId)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: fetchError?.message ?? "SACCO not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  let metadata = (existing.metadata as Record<string, unknown> | null) ?? {};

  if (logoUrl !== undefined) {
    updates.logo_url = logoUrl;
  }

  if (brandColor !== undefined) {
    const normalized =
      brandColor === null
        ? null
        : (brandColor.startsWith("#") ? brandColor : `#${brandColor}`).toUpperCase();
    if (normalized) {
      metadata = { ...metadata, brand_color: normalized };
    } else {
      const { brand_color: removedBrandColor, ...rest } = metadata;
      void removedBrandColor;
      metadata = rest;
    }
    updates.metadata = metadata;
  }

  const { error: updateError } = await supabase
    .schema("app")
    .from("saccos")
    .update(updates)
    .eq("id", saccoId);
  if (updateError) {
    return NextResponse.json(
      { error: updateError.message ?? "Failed to update branding" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    logoUrl: logoUrl ?? existing.logo_url ?? null,
    brandColor: brandColor ?? (metadata.brand_color as string | undefined) ?? null,
  });
}
