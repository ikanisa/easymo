import { supabase } from "../config.ts";

export async function claimEvent(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("wa_events")
    .upsert(
      { wa_message_id: id },
      {
        onConflict: "wa_message_id",
        ignoreDuplicates: true,
      },
    )
    .select("wa_message_id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function releaseEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from("wa_events")
    .delete()
    .eq("wa_message_id", id);
  if (error) throw error;
}
