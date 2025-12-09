/**
 * Admin Payment Assignment API Route
 *
 * Allows staff to assign unallocated payments to specific ikimina (groups) and members.
 * This is used during reconciliation when automated payment matching fails or when
 * manual review identifies the correct recipient.
 *
 * Use Cases:
 * - SMS parsing couldn't identify the ikimina from reference code
 * - Multiple members with similar names need manual disambiguation
 * - Correcting mis-assigned payments
 * - Bulk assignment of payments after importing statements
 *
 * Authorization:
 * - SYSTEM_ADMIN: Can assign payments in any SACCO
 * - SACCO_MANAGER/STAFF: Can only assign payments in their assigned SACCO
 * - Requires canReconcilePayments permission
 *
 * Operation:
 * 1. Validates user has reconciliation permissions
 * 2. Verifies ikimina exists and belongs to authorized SACCO
 * 3. Updates payment(s) with new ikimina_id and optional member_id
 * 4. Returns count of successfully updated payments
 *
 * @route POST /api/admin/payments/assign
 * @access SACCO_STAFF, SACCO_MANAGER, SYSTEM_ADMIN (with reconciliation permission)
 *
 * @example
 * POST /api/admin/payments/assign
 * {
 *   "ids": ["payment-uuid-1", "payment-uuid-2"],
 *   "ikiminaId": "ikimina-uuid",
 *   "memberId": "member-uuid"  // optional
 * }
 *
 * Response:
 * { "updated": 2 }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { canReconcilePayments, isSystemAdmin } from "@/lib/permissions";
import { sanitizeError } from "@/lib/errors";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { CONSTANTS } from "@/lib/constants";
import { getExtendedClient } from "@/lib/supabase/typed-client";

const payloadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  ikiminaId: z.string().uuid().optional(),
  memberId: z.string().uuid().nullable().optional(),
  saccoId: z.string().uuid().nullish(),
});

export async function POST(request: NextRequest) {
  // Rate limiting: 10 requests per minute for payment assignment
  const clientIP = await getClientIP();
  const rateLimitResponse = await checkRateLimit(
    `admin:assign-payment:${clientIP}`,
    CONSTANTS.RATE_LIMIT.STRICT
  );
  if (rateLimitResponse) return rateLimitResponse;

  const auth = await requireUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const { ids, ikiminaId, memberId, saccoId } = parsed.data;
  if (!ikiminaId) {
    return NextResponse.json({ error: "ikiminaId is required" }, { status: 400 });
  }

  try {
    const userProfile = auth.profile;
    const supabase = createSupabaseServiceRoleClient("admin/payments/assign");
    const extendedClient = getExtendedClient(supabase);

    // Determine SACCO scope for authorization
    const saccoScope = saccoId ?? userProfile.sacco_id ?? null;
    if (!isSystemAdmin(userProfile)) {
      if (!saccoScope || !canReconcilePayments(userProfile, saccoScope)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Verify ikimina exists and user has access to its SACCO
    const { data: ikiminaRow, error: ikiminaError } = await extendedClient
      .schema("app")
      .from("ikimina")
      .select("id, sacco_id")
      .eq("id", ikiminaId)
      .maybeSingle();

    if (ikiminaError || !ikiminaRow) {
      const sanitized = sanitizeError(ikiminaError);
      return NextResponse.json(
        { error: sanitized.message, code: sanitized.code },
        { status: 404 }
      );
    }

    if (!isSystemAdmin(userProfile) && ikiminaRow.sacco_id !== userProfile.sacco_id) {
      return NextResponse.json({ error: "Ikimina belongs to a different SACCO" }, { status: 403 });
    }

    // Build update payload - assign ikimina and optionally member
    const updatePayload: Record<string, unknown> = { ikimina_id: ikiminaId };
    if (memberId !== undefined) {
      updatePayload.member_id = memberId;
    }

    // Update payments with SACCO scope enforcement
    let query = extendedClient
      .schema("app")
      .from("payments")
      .update(updatePayload)
      .in("id", ids)
      .select("id");

    if (!isSystemAdmin(userProfile)) {
      if (!userProfile.sacco_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("sacco_id", userProfile.sacco_id);
    } else if (saccoId) {
      query = query.eq("sacco_id", saccoId);
    }

    const { data, error } = await query;
    if (error) {
      const sanitized = sanitizeError(error);
      return NextResponse.json(
        { error: sanitized.message, code: sanitized.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ updated: data?.length ?? 0 });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { error: sanitized.message, code: sanitized.code },
      { status: 500 }
    );
  }
}
