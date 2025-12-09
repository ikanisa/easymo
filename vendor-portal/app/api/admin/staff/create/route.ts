import { NextResponse } from "next/server";
import { logWarn } from "@/lib/observability/logger";
import { guardAdminAction } from "@/lib/admin/guard";
import type { Database } from "@/lib/supabase/types";
import { supabaseSrv } from "@/lib/supabase/server";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { getSupabaseAuthAdmin, getExtendedClient } from "@/lib/supabase/typed-client";
import { generateSecurePassword } from "@/lib/crypto";
import { sanitizeError, Errors } from "@/lib/errors";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { CONSTANTS } from "@/lib/constants";

export async function POST(request: Request) {
  // Rate limiting: 10 requests per minute for staff creation
  const clientIP = await getClientIP();
  const rateLimitResponse = await checkRateLimit(
    `admin:create-staff:${clientIP}`,
    CONSTANTS.RATE_LIMIT.STRICT
  );
  if (rateLimitResponse) return rateLimitResponse;

  const {
    email,
    role,
    sacco_id: saccoId,
    send_email: sendEmail = true,
  } = (await request.json().catch(() => ({}))) as {
    email?: string;
    role?: Database["public"]["Enums"]["app_role"];
    sacco_id?: string | null;
    send_email?: boolean;
  };

  if (!email || !role) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }
  if (role !== "SYSTEM_ADMIN" && !saccoId) {
    return NextResponse.json(
      { error: "sacco_id is required for non-admin roles" },
      { status: 400 }
    );
  }

  const guard = await guardAdminAction(
    {
      action: "admin_staff_create",
      reason: "Only system administrators can create staff.",
      logEvent: "admin_staff_create_denied",
      metadata: { email, role },
    },
    (error) => NextResponse.json({ error: error.message }, { status: 403 })
  );
  if (guard.denied) return guard.result;

  try {
    const supabase = supabaseSrv();
    const extendedClient = getExtendedClient(supabase);
    
    // Generate secure password with proper entropy
    const password = generateSecurePassword(CONSTANTS.PASSWORD.DEFAULT_LENGTH);

    const admin = getSupabaseAuthAdmin(supabase);
    const { data: created, error: createError } = await admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { pw_reset_required: true },
    });
    
    if (createError || !created?.user?.id) {
      const sanitized = sanitizeError(createError);
      return NextResponse.json(
        { error: sanitized.message, code: sanitized.code },
        { status: 500 }
      );
    }
    const userId = created.user.id as string;

    const { error: updateError } = await supabase
      .from("users")
      .update({ role, sacco_id: role === "SYSTEM_ADMIN" ? null : (saccoId ?? null) })
      .eq("id", userId);
      
    if (updateError) {
      const sanitized = sanitizeError(updateError);
      return NextResponse.json(
        { error: sanitized.message, code: sanitized.code },
        { status: 500 }
      );
    }

    // Optional: reflect in org_memberships if table exists (Phase 2)
    try {
      const res = await extendedClient
        .schema("app")
        .from("org_memberships")
        .upsert({ user_id: userId, org_id: saccoId, role }, { onConflict: "user_id,org_id" });
      if (res.error && !isMissingRelationError(res.error)) {
        logWarn("org_memberships upsert failed", res.error);
      }
    } catch {
      // Silently ignore if org_memberships doesn't exist
    }

    // Email
    if (sendEmail) {
      try {
        const url = process.env.EMAIL_WEBHOOK_URL;
        const key = process.env.EMAIL_WEBHOOK_KEY;
        if (url) {
          await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(key ? { Authorization: `Bearer ${key}` } : {}),
            },
            body: JSON.stringify({
              to: email,
              subject: "Welcome to the Staff Console",
              html: `<p>Welcome.</p><p>Temporary password: <b>${password}</b></p><p>Set a new password at first login.</p>`,
            }),
          }).catch(() => void 0);
        } else {
          await admin.inviteUserByEmail(email).catch(() => void 0);
        }
      } catch {
        // Email failure shouldn't block user creation
      }
    }

    return NextResponse.json({ ok: true, user_id: userId, password_sent: sendEmail });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { error: sanitized.message, code: sanitized.code },
      { status: 500 }
    );
  }
}
