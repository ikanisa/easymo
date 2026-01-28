import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

export type DiscoveryBudgetCheck = {
  allowed: boolean;
  reason?: string;
  count?: number;
};

export async function checkDiscoveryBudget(
  requestId: string,
  eventType: string,
  maxCalls: number,
): Promise<DiscoveryBudgetCheck> {
  const client = getClient();
  if (!client) {
    return { allowed: true, reason: "supabase_not_configured" };
  }

  const { count, error } = await client
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId)
    .eq("event_type", eventType);

  if (error) {
    return { allowed: true, reason: "audit_query_failed" };
  }

  if ((count ?? 0) >= maxCalls) {
    return { allowed: false, reason: "budget_exceeded", count };
  }

  return { allowed: true, count };
}
