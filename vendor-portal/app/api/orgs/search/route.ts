import { NextResponse } from "next/server";
import { supabaseSrv } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getExtendedClient } from "@/lib/supabase/typed-client";
import { sanitizeError } from "@/lib/errors";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "").toUpperCase();
  const q = (searchParams.get("q") ?? "").trim();

  if (!type || !["MFI", "DISTRICT"].includes(type)) {
    return NextResponse.json({ error: "Invalid or missing type" }, { status: 400 });
  }

  try {
    const supabase = supabaseSrv();
    const extendedClient = getExtendedClient(supabase);
    const orgType = type as unknown as Database["app"]["Enums"]["org_type"];

    let query = extendedClient
      .schema("app")
      .from("organizations")
      .select("id, name, type, district_code")
      .eq("type", orgType);
      
    if (q) {
      query = query.ilike("name", `%${q}%`);
    }
    
    const { data, error } = await query.limit(20);
    if (error) {
      const sanitized = sanitizeError(error);
      return NextResponse.json(
        { error: sanitized.message, code: sanitized.code },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      organizations: (data ?? []).map((o) => ({
        id: o.id as string,
        name: o.name as string,
        district_code: ((o as Record<string, unknown>).district_code as string | null) ?? null,
      })),
    });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { error: sanitized.message, code: sanitized.code },
      { status: 500 }
    );
  }
}
