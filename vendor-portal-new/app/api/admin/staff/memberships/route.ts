import { NextResponse } from "next/server";
import { guardAdminAction } from "@/lib/admin/guard";
import { supabaseSrv } from "@/lib/supabase/server";
import { getExtendedClient } from "@/lib/supabase/typed-client";
import { sanitizeError } from "@/lib/errors";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const guard = await guardAdminAction(
    { action: "admin_staff_memberships_list", reason: "Admins only" },
    (error) => NextResponse.json({ error: error.message }, { status: 403 })
  );
  if (guard.denied) return guard.result;

  try {
    const supabase = supabaseSrv();
    const extendedClient = getExtendedClient(supabase);

    const { data, error } = await extendedClient
      .schema("app")
      .from("org_memberships")
      .select("org_id, role, created_at, organizations(name, type)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
      
    if (error) {
      const sanitized = sanitizeError(error);
      return NextResponse.json(
        { error: sanitized.message, code: sanitized.code },
        { status: 500 }
      );
    }
    return NextResponse.json({ memberships: data ?? [] });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { error: sanitized.message, code: sanitized.code },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const {
    user_id: userId,
    org_id: orgId,
    role,
  } = (await request.json().catch(() => ({}))) as {
    user_id?: string;
    org_id?: string;
    role?: string;
  };
  if (!userId || !orgId || !role)
    return NextResponse.json({ error: "user_id, org_id, role required" }, { status: 400 });

  const guard = await guardAdminAction(
    { action: "admin_staff_memberships_add", reason: "Admins only" },
    (error) => NextResponse.json({ error: error.message }, { status: 403 })
  );
  if (guard.denied) return guard.result;

  try {
    const supabase = supabaseSrv();
    const extendedClient = getExtendedClient(supabase);

    const { error } = await extendedClient
      .schema("app")
      .from("org_memberships")
      .upsert({ user_id: userId, org_id: orgId, role }, { onConflict: "user_id,org_id" });
      
    if (error) {
      const sanitized = sanitizeError(error);
      return NextResponse.json(
        { error: sanitized.message, code: sanitized.code },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { error: sanitized.message, code: sanitized.code },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const orgId = searchParams.get("org_id");
  if (!userId || !orgId)
    return NextResponse.json({ error: "user_id and org_id required" }, { status: 400 });

  const guard = await guardAdminAction(
    { action: "admin_staff_memberships_remove", reason: "Admins only" },
    (error) => NextResponse.json({ error: error.message }, { status: 403 })
  );
  if (guard.denied) return guard.result;

  try {
    const supabase = supabaseSrv();
    const extendedClient = getExtendedClient(supabase);

    const { error } = await extendedClient
      .schema("app")
      .from("org_memberships")
      .delete()
      .eq("user_id", userId)
      .eq("org_id", orgId);
      
    if (error) {
      const sanitized = sanitizeError(error);
      return NextResponse.json(
        { error: sanitized.message, code: sanitized.code },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { error: sanitized.message, code: sanitized.code },
      { status: 500 }
    );
  }
}
