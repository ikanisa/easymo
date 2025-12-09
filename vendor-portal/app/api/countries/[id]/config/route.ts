import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AdminPermissionError, requireAdminContext } from "@/lib/admin/guard";
import { logError } from "@/lib/observability/logger";
import { getStubCountry, upsertStubCountryConfig } from "@/lib/stubs/multicountry";

const payloadSchema = z.object({
  referenceFormat: z
    .string()
    .min(5, "Reference format is required")
    .max(64, "Reference format is too long"),
  settlementNotes: z.string().max(1000).optional().nullable(),
  enabledFeatures: z.array(z.string().min(1)).min(1, "Select at least one feature"),
});

function normalizeFeatures(features: string[]): string[] {
  return Array.from(
    new Set(features.map((feature) => feature.trim()).filter((feature) => feature.length > 0))
  ).sort();
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const countryId = params.id;
  if (!countryId) {
    return NextResponse.json({ error: "Missing country id" }, { status: 400 });
  }

  let parsed;
  try {
    const payload = await request.json();
    parsed = payloadSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const referenceFormat = parsed.referenceFormat.trim().toUpperCase();
  const settlementNotes = parsed.settlementNotes?.trim() ?? "";
  const enabledFeatures = normalizeFeatures(parsed.enabledFeatures);

  if (process.env.AUTH_E2E_STUB === "1") {
    const stub = getStubCountry(countryId);
    if (!stub) {
      return NextResponse.json({ error: "Country not found" }, { status: 404 });
    }

    const updated = upsertStubCountryConfig(countryId, {
      reference_format: referenceFormat,
      settlement_notes: settlementNotes || null,
      enabled_features: enabledFeatures,
    });

    return NextResponse.json({
      data: {
        country_id: countryId,
        reference_format: updated.reference_format,
        settlement_notes: updated.settlement_notes,
        enabled_features: updated.enabled_features,
        updated_at: updated.updated_at,
      },
    });
  }

  try {
    const { supabase } = await requireAdminContext({
      action: "country_config_update",
      reason: "Updating country configuration requires system admin access",
      metadata: { countryId },
    });

    const { data, error } = await supabase
      .from("country_config")
      .upsert(
        {
          country_id: countryId,
          reference_format: referenceFormat,
          settlement_notes: settlementNotes || null,
          enabled_features: enabledFeatures,
        },
        { onConflict: "country_id" }
      )
      .select("country_id, reference_format, settlement_notes, enabled_features, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AdminPermissionError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError("country_config.update_failed", error);
    return NextResponse.json({ error: "Failed to update country configuration" }, { status: 500 });
  }
}
