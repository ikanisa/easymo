import { NextResponse } from "next/server";
import { logWarn } from "@/lib/observability/logger";
import { guardAdminAction } from "@/lib/admin/guard";
import type { Database } from "@/lib/supabase/types";
import { supabaseSrv } from "@/lib/supabase/server";
import { getExtendedClient } from "@/lib/supabase/typed-client";
import { sanitizeError } from "@/lib/errors";
import { CONSTANTS } from "@/lib/constants";

export async function PATCH(request: Request) {
  const {
    user_id: userId,
    role,
    sacco_id: saccoId,
    org_id: orgId,
  } = (await request.json().catch(() => ({}))) as {
    user_id?: string;
    role?: Database["public"]["Enums"]["app_role"];
    sacco_id?: string | null;
    org_id?: string | null;
  };

  if (!userId || !role) {
    return NextResponse.json({ error: "user_id and role are required" }, { status: 400 });
  }

  const guard = await guardAdminAction(
    {
      action: "admin_staff_assign_role",
      reason: "Only system administrators can update roles.",
      logEvent: "admin_staff_assign_role_denied",
      metadata: { targetUserId: userId },
    },
    (error) => NextResponse.json({ error: error.message }, { status: 403 })
  );
  if (guard.denied) return guard.result;

  try {
    const supabase = supabaseSrv();
    const extendedClient = getExtendedClient(supabase);

    const isSaccoRole = role === CONSTANTS.ROLES.SACCO_MANAGER || 
                        role === CONSTANTS.ROLES.SACCO_STAFF || 
                        role === CONSTANTS.ROLES.SACCO_VIEWER;
    const isDistrictRole = role === CONSTANTS.ROLES.DISTRICT_MANAGER;
    const isMfiRole = role === CONSTANTS.ROLES.MFI_MANAGER || role === CONSTANTS.ROLES.MFI_STAFF;

    // Validate required org and types
    if (isSaccoRole && !saccoId) {
      return NextResponse.json({ error: "sacco_id is required for SACCO roles" }, { status: 400 });
    }
    
    let resolvedOrgId: string | null = null;
    if (!isSaccoRole && (isDistrictRole || isMfiRole)) {
      if (!orgId) return NextResponse.json({ error: "org_id is required" }, { status: 400 });

      const { data: org, error: orgError } = await extendedClient
        .schema("app")
        .from("organizations")
        .select("id, type")
        .eq("id", orgId)
        .maybeSingle();
        
      if (orgError) {
        const sanitized = sanitizeError(orgError);
        return NextResponse.json(
          { error: sanitized.message, code: sanitized.code },
          { status: 500 }
        );
      }
      
      if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 400 });
      if (isDistrictRole && org.type !== CONSTANTS.ORG_TYPES.DISTRICT)
        return NextResponse.json({ error: "Role/org mismatch" }, { status: 400 });
      if (isMfiRole && org.type !== CONSTANTS.ORG_TYPES.MFI)
        return NextResponse.json({ error: "Role/org mismatch" }, { status: 400 });
      resolvedOrgId = org.id as string;
    }

    // Phase 1: update users table directly
    const { error } = await supabase
      .from("users")
      .update({ role, sacco_id: isSaccoRole ? (saccoId ?? null) : null })
      .eq("id", userId);
      
    if (error) {
      const sanitized = sanitizeError(error);
      return NextResponse.json(
        { error: sanitized.message, code: sanitized.code },
        { status: 500 }
      );
    }

    // Phase 2: reflect in org_memberships
    try {
      if (isSaccoRole && saccoId) {
        await extendedClient
          .schema("app")
          .from("org_memberships")
          .upsert({ user_id: userId, org_id: saccoId, role }, { onConflict: "user_id,org_id" });
      }
      if (!isSaccoRole && resolvedOrgId) {
        await extendedClient
          .schema("app")
          .from("org_memberships")
          .upsert({ user_id: userId, org_id: resolvedOrgId, role }, { onConflict: "user_id,org_id" });
      }
    } catch (e) {
      if (e && typeof e === "object" && "code" in e) {
        logWarn("org_memberships upsert failed", e);
      }
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
