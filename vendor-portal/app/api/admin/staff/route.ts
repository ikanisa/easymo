import { NextResponse } from "next/server";
import { z } from "zod";
import { guardAdminAction } from "@/lib/admin/guard";
import { supabaseSrv } from "@/lib/supabase/server";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { getExtendedClient } from "@/lib/supabase/typed-client";
import { sanitizeError } from "@/lib/errors";

// Validation schema for staff list query parameters
const staffQuerySchema = z.object({
  role: z.enum(["SYSTEM_ADMIN", "SACCO_MANAGER", "SACCO_STAFF", "SACCO_VIEWER"]).optional(),
  sacco_id: z.string().uuid().optional(),
  status: z.enum(["active", "suspended"]).optional(),
  q: z.string().max(100).optional(),
  org_type: z.enum(["MFI", "DISTRICT"]).optional(),
  org_id: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Validate query parameters
  const validationResult = staffQuerySchema.safeParse({
    role: searchParams.get("role") ?? undefined,
    sacco_id: searchParams.get("sacco_id") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    org_type: searchParams.get("org_type") ?? undefined,
    org_id: searchParams.get("org_id") ?? undefined,
  });

  if (!validationResult.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: validationResult.error.flatten() },
      { status: 400 }
    );
  }

  const {
    role,
    sacco_id: saccoId,
    status,
    q,
    org_type: orgType,
    org_id: orgId,
  } = validationResult.data;

  const guard = await guardAdminAction(
    {
      action: "admin_staff_list",
      reason: "Only system administrators can list staff.",
      logEvent: "admin_staff_list_denied",
    },
    (error) => NextResponse.json({ error: error.message }, { status: 403 })
  );

  if (guard.denied) return guard.result;

  try {
    const supabase = supabaseSrv();
    const extendedClient = getExtendedClient(supabase);

    let scopedUserIds: string[] | null = null;
    if (orgType) {
      const membershipQuery = extendedClient
        .schema("app")
        .from("org_memberships")
        .select("user_id, org_id, organizations(type)")
        .eq("organizations.type", orgType);
        
      const membershipQueryWithFilter = orgId
        ? membershipQuery.eq("org_id", orgId)
        : membershipQuery;
        
      const membershipResult = await membershipQueryWithFilter;
      
      if (membershipResult.error && !isMissingRelationError(membershipResult.error)) {
        const sanitized = sanitizeError(membershipResult.error);
        return NextResponse.json(
          { error: sanitized.message, code: sanitized.code },
          { status: 500 }
        );
      }
      
      const rows = (membershipResult.data ?? []) as Array<{ user_id: string | null }>;
      const ids = Array.from(
        new Set(
          rows
            .map((row) => row.user_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0)
        )
      );
      if (ids.length === 0) {
        return NextResponse.json({ users: [] });
      }
      scopedUserIds = ids;
    }

    let query = supabase
      .from("users")
      .select("id, email, role, sacco_id, created_at, suspended, saccos: saccos(name)");

    if (role) query = query.eq("role", role);
    if (saccoId) query = query.eq("sacco_id", saccoId);
    if (status === "active") query = query.eq("suspended", false);
    if (status === "suspended") query = query.eq("suspended", true);
    if (scopedUserIds) query = query.in("id", scopedUserIds);

    query = query.order("created_at", { ascending: false });

    const result = await query;
    if (result.error && !isMissingRelationError(result.error)) {
      const sanitized = sanitizeError(result.error);
      return NextResponse.json(
        { error: sanitized.message, code: sanitized.code },
        { status: 500 }
      );
    }

    let rows = (result.data ?? []) as Array<{
      id: string;
      email: string;
      role: string;
      sacco_id: string | null;
      created_at: string | null;
      suspended?: boolean | null;
      saccos?: { name: string | null } | null;
    }>;

    // Apply search filter if provided
    if (q && q.trim().length > 0) {
      const searchTerm = q.trim().toLowerCase();
      rows = rows.filter((r) => (r.email ?? "").toLowerCase().includes(searchTerm));
    }

    const users = rows.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      sacco_id: u.sacco_id,
      sacco_name: u.saccos?.name ?? null,
      created_at: u.created_at,
      suspended: Boolean(u.suspended),
    }));

    return NextResponse.json({ users });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { error: sanitized.message, code: sanitized.code },
      { status: 500 }
    );
  }
}
