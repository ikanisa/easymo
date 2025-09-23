import { supabase } from "../config.ts";

export async function markEventProcessed(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("wa_events")
    .select("wa_message_id")
    .eq("wa_message_id", id)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  if (data) return true;
  const { error: insertError } = await supabase.from("wa_events").insert({ wa_message_id: id });
  if (insertError) throw insertError;
  return false;
}
