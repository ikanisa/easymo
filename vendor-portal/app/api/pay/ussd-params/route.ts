import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const client = supabase as any;
  const auth = await getUserAndProfile();

  if (!auth) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const groupId = req.nextUrl.searchParams.get("group_id");

  if (!groupId) {
    return NextResponse.json({ error: "Missing group_id" }, { status: 400 });
  }

  const { data: group, error: groupError } = await client
    .schema("app")
    .from("ikimina")
    .select("id, name, sacco_id")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) {
    return NextResponse.json({ error: groupError.message }, { status: 500 });
  }

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const { data: sacco, error: saccoError } = await client
    .schema("app")
    .from("saccos")
    .select("merchant_code, sector_code, district, name")
    .eq("id", group.sacco_id)
    .maybeSingle();

  if (saccoError) {
    return NextResponse.json({ error: saccoError.message }, { status: 500 });
  }

  const { data: member } = await client
    .schema("app")
    .from("members")
    .select("member_code")
    .eq("ikimina_id", groupId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const district = (sacco?.district ?? "RW").slice(0, 3).toUpperCase();
  const saccoCode = (sacco?.name ?? "SAC").slice(0, 3).toUpperCase();
  const groupCode = group.name.slice(0, 4).toUpperCase();
  const memberCode = (member?.member_code ?? "000").toString().padStart(3, "0");

  const reference = `${district}.${saccoCode}.${groupCode}.${memberCode}`;

  return NextResponse.json({
    merchant_code: sacco?.merchant_code ?? "9XXXXX",
    reference,
    tel_link_supported: true,
  });
}
