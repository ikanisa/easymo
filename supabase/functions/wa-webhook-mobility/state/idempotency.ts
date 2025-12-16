import { supabase } from "../config.ts";

// Event type for idempotency tracking
const IDEMPOTENCY_EVENT_TYPE = "idempotency_check";

function getPgError(err: unknown): { code?: string; message?: string } {
  if (err && typeof err === "object" && (err as any).code) return err as any;
  try {
    return JSON.parse(String(err));
  } catch {
    return (err as any) ?? {};
  }
}

function isMissingColumn(err: unknown, column: string): boolean {
  const e = getPgError(err);
  const msg = (e.message || "").toLowerCase();
  return msg.includes(`'${column.toLowerCase()}'`) &&
    (msg.includes("column") || msg.includes("schema cache"));
}

function isNoUniqueConstraint(err: unknown): boolean {
  const e = getPgError(err);
  const msg = (e.message || "").toLowerCase();
  // PostgREST uses PGRST204 for several schema errors
  return (e.code === "PGRST204" &&
    (msg.includes("unique") || msg.includes("conflict"))) ||
    msg.includes("no unique") ||
    msg.includes("does not have a unique constraint");
}

export async function claimEvent(id: string): Promise<boolean> {
  // Prefer new column name
  try {
    const { data, error } = await supabase
      .from("wa_events")
      .upsert(
        { message_id: id, event_type: IDEMPOTENCY_EVENT_TYPE },
        { onConflict: "message_id", ignoreDuplicates: true },
      )
      .select("message_id");
    if (error) throw error;
    return (data ?? []).length > 0;
  } catch (err) {
    if (isNoUniqueConstraint(err)) {
      // Fallback path when UNIQUE(message_id) is missing: best-effort select then insert (race-prone)
      const pre = await supabase.from("wa_events").select("message_id").eq(
        "message_id",
        id,
      ).maybeSingle();
      if (!pre.error && pre.data) return false; // already exists
      // try plain insert
      const ins = await supabase.from("wa_events").insert({
        message_id: id,
        event_type: IDEMPOTENCY_EVENT_TYPE,
      });
      if (ins.error) throw ins.error;
      return true;
    }
    if (!isMissingColumn(err, "message_id")) throw err;
    // Fallback for older schemas during rollout
    const { data, error } = await supabase
      .from("wa_events")
      .upsert(
        // @ts-ignore: legacy column
        { wa_message_id: id, event_type: IDEMPOTENCY_EVENT_TYPE },
        // @ts-ignore: legacy column
        { onConflict: "wa_message_id", ignoreDuplicates: true },
      )
      // @ts-ignore: legacy column
      .select("wa_message_id");
    if (error) throw error;
    return (data ?? []).length > 0;
  }
}

export async function releaseEvent(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("wa_events")
      .delete()
      .eq("message_id", id);
    if (error) throw error;
  } catch (err) {
    if (!isMissingColumn(err, "message_id")) throw err;
    // @ts-ignore fallback legacy column
    const { error } = await supabase
      .from("wa_events")
      .delete()
      // @ts-ignore: legacy column
      .eq("wa_message_id", id);
    if (error) throw error;
  }
}
