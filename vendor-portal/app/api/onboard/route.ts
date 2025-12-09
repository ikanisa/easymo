import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import { OnboardReq } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const client = supabase as any;
  const auth = await getUserAndProfile();

  if (!auth) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = OnboardReq.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { whatsapp_msisdn, momo_msisdn } = parsed.data;

  const { error } = await client.from("members_app_profiles").upsert(
    {
      user_id: auth.user.id,
      whatsapp_msisdn,
      momo_msisdn,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
