import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/observability/logger";
import { buildUssdPayload } from "@ibimina/lib";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadUssdTemplate } from "@/lib/ussd/templates";
import type { Database } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  const groupId = request.nextUrl.searchParams.get("group_id");

  if (!groupId) {
    return NextResponse.json({ error: "Missing group id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: group, error: groupError } = await supabase
    .schema("app")
    .from("ikimina")
    .select("id, code, name, sacco_id")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) {
    logError("Failed to load group", groupError);
    return NextResponse.json({ error: "Unable to load group" }, { status: 500 });
  }

  const groupRow = (group ?? null) as Pick<
    Database["app"]["Tables"]["ikimina"]["Row"],
    "id" | "code" | "name" | "sacco_id"
  > | null;

  if (!groupRow) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const { data: sacco, error: saccoError } = await supabase
    .schema("app")
    .from("saccos")
    .select("name, district, sector_code")
    .eq("id", groupRow.sacco_id)
    .maybeSingle();

  if (saccoError) {
    logError("Failed to load sacco", saccoError);
    return NextResponse.json({ error: "Unable to load SACCO" }, { status: 500 });
  }

  const saccoRow = (sacco ?? null) as Pick<
    Database["app"]["Tables"]["saccos"]["Row"],
    "name" | "district" | "sector_code"
  > | null;

  const districtRaw = saccoRow?.district ?? null;
  const districtKey = districtRaw?.trim().toUpperCase() ?? null;

  let merchant = saccoRow?.sector_code ?? "182000";
  let provider = "MTN";
  let accountName = saccoRow?.name ?? null;

  if (districtKey) {
    const { data: momoCode, error: momoError } = await supabase
      .schema("app")
      .from("momo_codes")
      .select("code, provider, account_name")
      .eq("provider", provider)
      .eq("district", districtKey)
      .maybeSingle();

    if (momoError && momoError.code !== "PGRST116") {
      logError("Failed to load MoMo code", momoError);
    }

    if (momoCode?.code) {
      merchant = momoCode.code;
      provider = momoCode.provider ?? provider;
      accountName = momoCode.account_name ?? accountName;
    }
  }

  const districtSlug = districtKey?.replace(/\s+/g, "-") ?? "DISTRICT";
  const saccoSlug = saccoRow?.name?.split(" ")[0]?.toUpperCase() ?? "SACCO";
  const reference = `${districtSlug}.${saccoSlug}.${groupRow.code}`;

  const operatorId = provider.toLowerCase() === "airtel" ? "airtel-rw" : "mtn-rw";
  const template = await loadUssdTemplate(supabase, operatorId);

  const androidPayload = buildUssdPayload({
    merchantCode: merchant,
    reference,
    operator: template.operator,
    platform: "android",
    versionOverride: template.version,
    ttlSecondsOverride: template.ttlSeconds,
  });

  const iosPayload = buildUssdPayload({
    merchantCode: merchant,
    reference,
    operator: template.operator,
    platform: "ios",
    versionOverride: template.version,
    ttlSecondsOverride: template.ttlSeconds,
  });

  const maxAge = Math.min(template.ttlSeconds, 600);
  const staleWhileRevalidate = Math.min(template.ttlSeconds * 2, 1800);

  return NextResponse.json(
    {
      merchant,
      provider,
      account_name: accountName,
      reference,
      ussd: {
        operator: template.operator.id,
        version: template.version,
        ttlSeconds: template.ttlSeconds,
        expiresAt: new Date(template.expiresAt).toISOString(),
        code: androidPayload.code,
        android: {
          telUri: androidPayload.telUri,
          canAutoDial: androidPayload.canAutoDial,
          ctaLabel: androidPayload.ctaLabel,
          expiresAt: androidPayload.expiresAt,
        },
        ios: {
          copyText: iosPayload.copyText,
          instructions: iosPayload.instructions,
          expiresAt: iosPayload.expiresAt,
        },
      },
    },
    {
      headers: {
        "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
      },
    }
  );
}
