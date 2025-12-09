import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AdminPermissionError, requireAdminContext } from "@/lib/admin/guard";
import { logError } from "@/lib/observability/logger";
import { getStubPartner, upsertStubPartnerConfig } from "@/lib/stubs/multicountry";

const payloadSchema = z.object({
  merchantCode: z.string().optional().nullable(),
  referencePrefix: z.string().optional().nullable(),
  enabledFeatures: z.array(z.string()).optional(),
  languagePack: z.array(z.string()).optional(),
  contact: z
    .object({
      phone: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      hours: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

function normalizeArray(values: string[] | undefined): string[] {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))
  ).sort();
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const partnerId = params.id;
  if (!partnerId) {
    return NextResponse.json({ error: "Missing partner id" }, { status: 400 });
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

  const merchantCode = parsed.merchantCode?.trim();
  const referencePrefix = parsed.referencePrefix?.trim();
  const enabledFeatures = normalizeArray(parsed.enabledFeatures);
  const languagePack = normalizeArray(parsed.languagePack);

  if (languagePack.length === 0) {
    return NextResponse.json({ error: "At least one language is required" }, { status: 400 });
  }

  const contactRaw = parsed.contact ?? null;
  const contact = contactRaw
    ? {
        phone: contactRaw.phone?.trim() || null,
        email: contactRaw.email?.trim() || null,
        hours: contactRaw.hours?.trim() || null,
      }
    : null;
  const hasContact = contact && (contact.phone || contact.email || contact.hours);
  const normalizedContact = hasContact ? contact : null;

  if (process.env.AUTH_E2E_STUB === "1") {
    const stub = getStubPartner(partnerId);
    if (!stub) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const updated = upsertStubPartnerConfig(partnerId, {
      merchant_code: merchantCode ? merchantCode.toUpperCase() : null,
      reference_prefix: referencePrefix ? referencePrefix.toUpperCase() : null,
      enabled_features: enabledFeatures,
      language_pack: languagePack,
      contact: normalizedContact,
    });

    return NextResponse.json({
      data: {
        org_id: partnerId,
        merchant_code: updated.merchant_code,
        reference_prefix: updated.reference_prefix,
        enabled_features: updated.enabled_features,
        language_pack: updated.language_pack,
        contact: updated.contact,
        updated_at: updated.updated_at,
      },
    });
  }

  try {
    const { supabase } = await requireAdminContext({
      action: "partner_config_update",
      reason: "Updating partner configuration requires system admin access",
      metadata: { partnerId },
    });

    const { data, error } = await supabase
      .from("partner_config")
      .upsert(
        {
          org_id: partnerId,
          merchant_code: merchantCode ? merchantCode.toUpperCase() : null,
          reference_prefix: referencePrefix ? referencePrefix.toUpperCase() : null,
          enabled_features: enabledFeatures,
          language_pack: languagePack,
          contact: normalizedContact,
        },
        { onConflict: "org_id" }
      )
      .select(
        "org_id, merchant_code, reference_prefix, enabled_features, language_pack, contact, updated_at"
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AdminPermissionError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    logError("partner_config.update_failed", error);
    return NextResponse.json({ error: "Failed to update partner configuration" }, { status: 500 });
  }
}
