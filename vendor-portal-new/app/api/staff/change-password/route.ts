/**
 * Staff Password Change API Route
 *
 * Allows staff to change their own password
 * RESTRICTION: Only allowed from web platform, not mobile apps
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import { logError } from "@/lib/observability/logger";

export async function POST(request: Request) {
  try {
    // Check authentication
    const context = await getUserAndProfile();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Check if request is from mobile platform
    const userAgent = request.headers.get("user-agent") || "";
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(userAgent);
    const isCapacitor = userAgent.includes("Capacitor");

    if (isMobile || isCapacitor) {
      return NextResponse.json(
        {
          error: "Password changes are not allowed on mobile devices",
          message: "Please use the web application to change your password",
          platform_restriction: true,
        },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Verify current password by attempting to sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: context.user.email!,
      password: currentPassword,
    });

    if (verifyError) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      logError("staff.password_update_failed", { error: updateError });
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    // Log the password change
    const { error: auditError } = await supabase
      .schema("app")
      .from("audit_logs")
      .insert({
        action: "staff_password_changed",
        entity: "user",
        entity_id: context.user.id,
        metadata: {
          email: context.user.email,
          changed_at: new Date().toISOString(),
        },
      });

    if (auditError) {
      logError("staff.password_audit_failed", { error: auditError });
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    logError("staff.password_change_unhandled", { error });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
