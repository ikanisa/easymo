import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export type AgentPersonaRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function fetchAgentPersonas(): Promise<AgentPersonaRow[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("supabase_unavailable");
  }

  const { data, error } = await supabase
    .from("agent_personas")
    .select("id,name,slug,description,status,metadata,created_at,updated_at")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
