"use client";

import { useMemo } from "react";
import {
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type { AgentRequest } from "@/lib/supabase/server/requests";
import type { NegotiationThread } from "@/lib/supabase/server/negotiations";
import type { KnowledgeAsset } from "@/lib/supabase/server/knowledge";
import type { AgentTool } from "@/lib/supabase/server/tools";
import type { AgentTask } from "@/lib/supabase/server/tasks";
import { useSupabaseRealtime } from "@/lib/supabase/realtime";

const JSON_HEADERS = { "Content-Type": "application/json" };

export type DriverRequestsParams = {
  agentType?: string;
  status?: string;
  limit?: number;
};

const driverRequestsKey = (params?: DriverRequestsParams): QueryKey => [
  "driver-requests",
  params ?? {},
];

export async function fetchDriverRequests(params?: DriverRequestsParams) {
  const query = new URLSearchParams();
  if (params?.agentType) query.set("agentType", params.agentType);
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  const response = await fetch(`/api/driver-requests${qs ? `?${qs}` : ""}`, {
    headers: JSON_HEADERS,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "driver_requests_fetch_failed");
  }

  const json = await response.json();
  return (json.requests ?? []) as AgentRequest[];
}

export function useDriverRequests(
  params?: DriverRequestsParams,
  options?: UseQueryOptions<AgentRequest[], Error>,
) {
  const queryClient = useQueryClient();
  const key = useMemo(() => driverRequestsKey(params), [params]);

  useSupabaseRealtime(["drivers", "negotiations", "sla"], (payload, domain) => {
    const record = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
    if (domain === "negotiations") {
      const sessionId =
        (record.session_id as string | undefined) ??
        (record.id as string | undefined);
      if (!sessionId) return;
      queryClient.invalidateQueries({ queryKey: key });
      return;
    }
    if (domain === "sla" || domain === "drivers") {
      queryClient.invalidateQueries({ queryKey: key });
      return;
    }
  });

  return useQuery({
    queryKey: key,
    queryFn: () => fetchDriverRequests(params),
    ...options,
  });
}

const negotiationThreadKey = (sessionId?: string): QueryKey => [
  "negotiation-thread",
  sessionId ?? null,
];

export async function fetchNegotiationThread(sessionId: string) {
  const response = await fetch(`/api/negotiations/${sessionId}/thread`, {
    headers: JSON_HEADERS,
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "negotiation_thread_fetch_failed");
  }
  const json = await response.json();
  return json.thread as NegotiationThread;
}

export function useNegotiationThread(
  sessionId?: string,
  options?: UseQueryOptions<NegotiationThread, Error>,
) {
  const queryClient = useQueryClient();
  const key = useMemo(() => negotiationThreadKey(sessionId), [sessionId]);

  useSupabaseRealtime(["negotiations", "sla"], (payload, domain) => {
    if (!sessionId) return;
    const record = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
    if (domain === "negotiations") {
      const sessionRef =
        (record.session_id as string | undefined) ??
        (record.id as string | undefined);
      if (sessionRef !== sessionId) return;
      queryClient.invalidateQueries({ queryKey: key });
    }
    if (domain === "sla") {
      const sessionRef = record.id as string | undefined;
      if (sessionRef !== sessionId) return;
      queryClient.invalidateQueries({ queryKey: key });
    }
  });

  return useQuery({
    queryKey: key,
    queryFn: () => fetchNegotiationThread(sessionId!),
    enabled: Boolean(sessionId),
    ...options,
  });
}

const knowledgeAssetsKey = (agentId?: string): QueryKey => [
  "knowledge-assets",
  agentId ?? null,
];

export async function fetchKnowledgeAssets(agentId?: string) {
  const query = new URLSearchParams();
  if (agentId) query.set("agentId", agentId);
  const qs = query.toString();
  const response = await fetch(`/api/knowledge-assets${qs ? `?${qs}` : ""}`, {
    headers: JSON_HEADERS,
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "knowledge_assets_fetch_failed");
  }
  const json = await response.json();
  return (json.assets ?? []) as KnowledgeAsset[];
}

export function useKnowledgeAssets(
  agentId?: string,
  options?: UseQueryOptions<KnowledgeAsset[], Error>,
) {
  const key = useMemo(() => knowledgeAssetsKey(agentId), [agentId]);
  return useQuery({
    queryKey: key,
    queryFn: () => fetchKnowledgeAssets(agentId),
    ...options,
  });
}

const agentToolsKey = (includeDisabled: boolean): QueryKey => [
  "agent-tools",
  includeDisabled,
];

export async function fetchAgentTools(includeDisabled = true) {
  const query = new URLSearchParams();
  if (!includeDisabled) {
    query.set("includeDisabled", "false");
  }
  const qs = query.toString();
  const response = await fetch(`/api/agent-tools${qs ? `?${qs}` : ""}`, {
    headers: JSON_HEADERS,
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "agent_tools_fetch_failed");
  }
  const json = await response.json();
  return (json.tools ?? []) as AgentTool[];
}

export function useAgentTools(
  includeDisabled = true,
  options?: UseQueryOptions<AgentTool[], Error>,
) {
  const key = useMemo(() => agentToolsKey(includeDisabled), [includeDisabled]);
  return useQuery({
    queryKey: key,
    queryFn: () => fetchAgentTools(includeDisabled),
    ...options,
  });
}

const agentTasksKey = (agentId?: string): QueryKey => [
  "agent-tasks",
  agentId ?? null,
];

export async function fetchAgentTasks(agentId?: string) {
  const query = new URLSearchParams();
  if (agentId) query.set("agentId", agentId);
  const qs = query.toString();
  const response = await fetch(`/api/agent-tasks${qs ? `?${qs}` : ""}`, {
    headers: JSON_HEADERS,
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "agent_tasks_fetch_failed");
  }
  const json = await response.json();
  return (json.tasks ?? []) as AgentTask[];
}

export function useAgentTasks(
  agentId?: string,
  options?: UseQueryOptions<AgentTask[], Error>,
) {
  const queryClient = useQueryClient();
  const key = useMemo(() => agentTasksKey(agentId), [agentId]);

  useSupabaseRealtime("tasks", (payload) => {
    const record = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
    if (agentId && record.agent_id !== agentId) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: key });
  });

  return useQuery({
    queryKey: key,
    queryFn: () => fetchAgentTasks(agentId),
    ...options,
  });
}
