import { jsonError,jsonOk } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export type AgentDefinition = {
  id: string;
  key: string | null;
  name: string;
  description: string | null;
  status: string;
  active_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentVersion = {
  id: string;
  agent_id: string;
  version: number;
  instructions: string | null;
  config: Record<string, unknown>;
  status: string;
  created_at: string;
};

export async function listAgents() {
  const db = getSupabaseAdminClient();
  if (!db) return jsonError({ error: "supabase_unavailable" }, 503);
  const { data, error } = await db
    .from("agent_definitions")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return jsonError({ error: error.message }, 500);
  return jsonOk({ agents: (data ?? []) as AgentDefinition[] });
}

export async function createAgent(body: { name: string; key?: string | null; description?: string | null }) {
  const db = getSupabaseAdminClient();
  if (!db) return jsonError({ error: "supabase_unavailable" }, 503);
  const payload = {
    name: body.name,
    key: body.key ?? null,
    description: body.description ?? null,
  };
  const { data, error } = await db
    .from("agent_definitions")
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) return jsonError({ error: error?.message ?? "insert_failed" }, 500);
  return jsonOk({ agent: data as AgentDefinition }, 201);
}

export async function getAgent(id: string) {
  const db = getSupabaseAdminClient();
  if (!db) return jsonError({ error: "supabase_unavailable" }, 503);
  const { data: agent, error } = await db
    .from("agent_definitions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return jsonError({ error: error.message }, 500);
  if (!agent) return jsonError({ error: "not_found" }, 404);

  const { data: versions } = await db
    .from("agent_versions")
    .select("*")
    .eq("agent_id", id)
    .order("version", { ascending: false });
  const { data: docs } = await db
    .from("agent_documents")
    .select("id, title, created_at")
    .eq("agent_id", id)
    .order("created_at", { ascending: false });
  return jsonOk({ agent, versions: versions ?? [], documents: docs ?? [] });
}

export async function updateAgent(id: string, body: { name?: string; description?: string | null }) {
  const db = getSupabaseAdminClient();
  if (!db) return jsonError({ error: "supabase_unavailable" }, 503);
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (body.description !== undefined) patch.description = body.description;
  if (Object.keys(patch).length === 0) return jsonOk({ updated: false });
  const { error } = await db
    .from("agent_definitions")
    .update(patch)
    .eq("id", id);
  if (error) return jsonError({ error: error.message }, 500);
  return jsonOk({ updated: true });
}

export async function createVersion(id: string, body: { instructions?: string; config?: Record<string, unknown> }) {
  const db = getSupabaseAdminClient();
  if (!db) return jsonError({ error: "supabase_unavailable" }, 503);
  const { data: maxRow } = await db
    .from("agent_versions")
    .select("version")
    .eq("agent_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = (maxRow?.version ?? 0) + 1;
  const payload = {
    agent_id: id,
    version: next,
    instructions: body.instructions ?? null,
    config: body.config ?? {},
    status: "draft",
  };
  const { data, error } = await db
    .from("agent_versions")
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) return jsonError({ error: error?.message ?? "insert_failed" }, 500);
  return jsonOk({ version: data as AgentVersion }, 201);
}

export async function deployVersion(id: string, body: { version: number }) {
  const db = getSupabaseAdminClient();
  if (!db) return jsonError({ error: "supabase_unavailable" }, 503);
  const { data, error } = await db.rpc("agent_deploy", { p_agent_id: id, p_version: body.version });
  if (error) return jsonError({ error: error.message }, 500);
  return jsonOk({ deployed_version_id: data });
}

