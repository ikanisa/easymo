import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AnyClient = SupabaseClient<any, any, any>;

export const recordMetric = async (
  supabase: AnyClient,
  eventName: string,
  delta = 1,
  meta: Record<string, unknown> | null = null
) => {
  const { error } = await supabase.rpc("increment_metric", {
    event_name: eventName,
    delta,
    meta: meta ?? {},
  });

  if (error) {
    console.error("metric error", error);
  }
};
