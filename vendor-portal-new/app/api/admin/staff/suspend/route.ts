import { NextResponse } from "next/server";
import { guardAdminAction } from "@/lib/admin/guard";
import { supabaseSrv } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/errors";

export async function PATCH(request: Request) {
  const { user_id: userId, suspended } = (await request.json().catch(() => ({}))) as {
    user_id?: string;
    suspended?: boolean;
  };

  if (!userId || typeof suspended !== "boolean") {
    return NextResponse.json({ error: "user_id and suspended are required" }, { status: 400 });
  }

  const guard = await guardAdminAction(
    {
      action: "admin_staff_suspend_toggle",
      reason: "Only system administrators can suspend staff.",
      logEvent: "admin_staff_suspend_toggle_denied",
      metadata: { targetUserId: userId },
    },
    (error) => NextResponse.json({ error: error.message }, { status: 403 })
  );
  if (guard.denied) return guard.result;

  try {
    const supabase = supabaseSrv();

    const { error } = await supabase.from("users").update({ suspended }).eq("id", userId);
    if (error) {
      const sanitized = sanitizeError(error);
      return NextResponse.json(
        { error: sanitized.message, code: sanitized.code },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, suspended });
  } catch (error) {
    const sanitized = sanitizeError(error);
    return NextResponse.json(
      { error: sanitized.message, code: sanitized.code },
      { status: 500 }
    );
  }
}
