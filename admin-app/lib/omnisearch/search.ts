import type { SupabaseClient } from "@supabase/supabase-js";

import type { OmniSearchResult } from "./types";

interface SearchOptions {
  limitPerCategory?: number;
}

const DEFAULT_LIMIT = 6;

function normaliseQuery(query: string): string {
  return query.trim();
}

function safePreview(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function runOmniSearch(
  supabase: SupabaseClient,
  rawQuery: string,
  { limitPerCategory = DEFAULT_LIMIT }: SearchOptions = {},
): Promise<OmniSearchResult[]> {
  const query = normaliseQuery(rawQuery);
  if (!query) return [];

  const likePattern = `%${query}%`;

  const [agentsRes, requestsRes, policiesRes, tasksRes] = await Promise.allSettled([
    supabase
      .from("agent_registry")
      .select("id, agent_type, name, description, enabled, sla_minutes")
      .or(`name.ilike.${likePattern},agent_type.ilike.${likePattern}`)
      .order("updated_at", { ascending: false })
      .limit(limitPerCategory),
    supabase
      .from("agent_sessions")
      .select("id, status, agent_type, started_at, deadline_at")
      .ilike("agent_type", likePattern)
      .order("started_at", { ascending: false })
      .limit(limitPerCategory),
    supabase
      .from("settings")
      .select("key, value, updated_at")
      .ilike("key", likePattern)
      .order("updated_at", { ascending: false })
      .limit(limitPerCategory),
    supabase
      .from("agent_tasks")
      .select("id, status, agent_id, title, due_at")
      .or(`title.ilike.${likePattern},status.ilike.${likePattern}`)
      .order("created_at", { ascending: false })
      .limit(limitPerCategory),
  ]);

  const results: OmniSearchResult[] = [];

  if (agentsRes.status === "fulfilled" && !agentsRes.value.error) {
    for (const row of agentsRes.value.data ?? []) {
      results.push({
        category: "agent",
        id: row.id,
        agentType: row.agent_type,
        personaId: row.id,
        title: row.name ?? row.agent_type,
        subtitle: row.agent_type,
        description: row.description,
        enabled: row.enabled,
        slaMinutes: row.sla_minutes,
      });
    }
  }

  if (requestsRes.status === "fulfilled" && !requestsRes.value.error) {
    for (const row of requestsRes.value.data ?? []) {
      results.push({
        category: "request",
        id: row.id,
        agentType: row.agent_type,
        status: row.status,
        title: `${row.agent_type ?? "Session"} · ${row.status}`,
        subtitle: row.started_at,
        description: row.deadline_at,
        startedAt: row.started_at,
        deadlineAt: row.deadline_at,
      });
    }
  }

  if (policiesRes.status === "fulfilled" && !policiesRes.value.error) {
    for (const row of policiesRes.value.data ?? []) {
      const preview = safePreview(row.value);
      results.push({
        category: "policy",
        id: row.key,
        key: row.key,
        title: row.key,
        description: preview,
        valuePreview: preview,
        updatedAt: row.updated_at,
      });
    }
  }

  if (tasksRes.status === "fulfilled" && !tasksRes.value.error) {
    for (const row of tasksRes.value.data ?? []) {
      results.push({
        category: "task",
        id: row.id,
        agentId: row.agent_id,
        status: row.status,
        title: row.title ?? `Task ${row.id.slice(0, 8)}`,
        subtitle: row.status ?? undefined,
        dueAt: row.due_at,
      });
    }
  }

  return results;
}
