import { supabase } from "../../../config.ts";

const LIMIT = 9;

export async function listPromoters(window: string) {
  const { data, error } = await supabase
    .from("leaderboard_snapshots")
    .select("snapshot_window, generated_at, top9, your_rank_map")
    .eq("snapshot_window", window)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return { top9: [], generated_at: null, your_rank_map: {} };
  }
  const top9 = (data.top9 ?? []).slice(0, LIMIT);
  return {
    top9,
    generated_at: data.generated_at,
    your_rank_map: data.your_rank_map ?? {},
  };
}
