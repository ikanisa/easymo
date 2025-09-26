import type { RouterContext } from "../types.ts";
import { sendText } from "../wa/client.ts";
import { ensureSession } from "../exchange/helpers.ts";
import { hashStaffVerificationCode } from "../utils/staff_verification.ts";

const CODE_REGEX = /(code|join|verify)?\s*(\d{6})/i;

export async function handleStaffVerification(
  ctx: RouterContext,
  body: string,
): Promise<boolean> {
  const match = body.match(CODE_REGEX) ??
    (body.length === 6 && /\d{6}/.test(body) ? [body, "", body] : null);
  if (!match) return false;
  const code = match[2] ?? match[0];
  if (!code || code.length !== 6) return false;

  const { data, error } = await ctx.supabase
    .from("bar_numbers")
    .select(
      "id, bar_id, role, is_active, verified_at, verification_code_hash, verification_expires_at, verification_attempts",
    )
    .eq("number_e164", ctx.from)
    .eq("is_active", true)
    .order("invited_at", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) {
    await sendText(
      ctx.from,
      "Something went wrong verifying your code. Please try again in a moment.",
    );
    return true;
  }
  const rows = data ?? [];
  if (!rows.length) {
    await sendText(
      ctx.from,
      "We couldn't find a pending staff invite for this number. Ask your manager to send a new invite.",
    );
    return true;
  }

  const now = new Date();
  for (const row of rows) {
    if (!row.verification_code_hash) continue;
    const expectedHash = await hashStaffVerificationCode(
      code,
      row.bar_id,
      ctx.from,
    );
    if (expectedHash !== row.verification_code_hash) continue;

    if (
      row.verification_expires_at && new Date(row.verification_expires_at) < now
    ) {
      await ctx.supabase
        .from("bar_numbers")
        .update({
          verification_code_hash: null,
          verification_expires_at: null,
          verification_attempts: Number(row.verification_attempts ?? 0) + 1,
          updated_at: now.toISOString(),
        })
        .eq("id", row.id);
      await sendText(
        ctx.from,
        "This invite code expired. Ask your manager to send a fresh one.",
      );
      return true;
    }

    await ctx.supabase
      .from("bar_numbers")
      .update({
        verified_at: now.toISOString(),
        verification_code_hash: null,
        verification_expires_at: null,
        verification_attempts: 0,
        last_seen_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", row.id);

    const sessionRole = row.role === "manager"
      ? "vendor_manager"
      : "vendor_staff";
    await ensureSession({
      waId: ctx.from,
      role: sessionRole,
      barId: row.bar_id,
      currentFlow: null,
      context: { staff_verified_at: now.toISOString() },
    });

    const { data: bar } = await ctx.supabase
      .from("bars")
      .select("name")
      .eq("id", row.bar_id)
      .maybeSingle();
    const barName = bar?.name ?? "the bar";
    await sendText(
      ctx.from,
      `Thanks! You're now verified for ${barName}. Open the staff menu to manage orders.`,
    );
    return true;
  }

  // No matching code found; increment attempts for the most recent invite
  const latest = rows[0];
  await ctx.supabase
    .from("bar_numbers")
    .update({
      verification_attempts: Number(latest.verification_attempts ?? 0) + 1,
      updated_at: now.toISOString(),
    })
    .eq("id", latest.id);
  await sendText(
    ctx.from,
    "That code didn't match. Double-check and reply with CODE 123456 from the invite message.",
  );
  return true;
}
