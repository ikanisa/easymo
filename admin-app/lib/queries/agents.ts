import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  listDriverRequests,
  type DriverRequestsResponse,
} from "@/lib/agents/driver-requests-service";
import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";

const DRIVER_REQUESTS_KEY: QueryKey = ["agents", "driver", "requests"];

const agentQueryKeys = {
  list: ["agents", "list"] as const,
  detail: (agentId: string) => ["agents", "detail", agentId] as const,
  tasks: (agentId: string) => ["agents", "tasks", agentId] as const,
  runs: (agentId: string, params?: { status?: string | null; limit?: number | null }) =>
    ["agents", "runs", agentId, params?.status ?? null, params?.limit ?? null] as const,
  runDetail: (agentId: string, runId: string) => ["agents", "runs", agentId, runId] as const,
  audit: (agentId: string) => ["agents", "audit", agentId] as const,
};

type AgentListResponse = { agents: unknown[] };

type AgentDetailAggregate = {
  agent: Record<string, unknown> | null;
  versions: unknown[];
  documents: unknown[];
  vectorStats?: {
    totalDocs: number;
    readyDocs: number;
    jsonChunks: number;
    vecChunks: number;
  };
};

type AgentTasksResponse = { tasks: unknown[] };
type AgentRunsResponse = { runs: unknown[] };
type AgentRunDetailResponse = { run: unknown };
type AgentAuditResponse = { events: unknown[] };

export function fetchDriverRequests() {
  return listDriverRequests();
}

export function useDriverRequestsQuery(
  options?: UseQueryOptions<
    DriverRequestsResponse,
    unknown,
    DriverRequestsResponse
  >,
) {
  return useQuery({
    queryKey: DRIVER_REQUESTS_KEY,
    queryFn: fetchDriverRequests,
    staleTime: 20_000,
    ...options,
  });
}

export const driverQueryKeys = {
  requests: () => DRIVER_REQUESTS_KEY,
};

export function useAgentsList(
  options?: UseQueryOptions<AgentListResponse, unknown, AgentListResponse>,
) {
  return useQuery({
    queryKey: agentQueryKeys.list,
    queryFn: () => apiFetch<AgentListResponse>(getAdminApiPath("agents")),
    staleTime: 60_000,
    ...options,
  });
}

export function useCreateAgent(
  options?: UseMutationOptions<
    unknown,
    unknown,
    { name: string; key?: string | null; summary?: string | null; default_language?: string; tags?: string[] }
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiFetch(getAdminApiPath("agents"), {
        method: "POST",
        body: payload,
      }),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: agentQueryKeys.list });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useAgentDetailAggregate(
  agentId?: string,
  options?: UseQueryOptions<AgentDetailAggregate, unknown, AgentDetailAggregate>,
) {
  return useQuery({
    queryKey: agentQueryKeys.detail(agentId ?? "unknown"),
    queryFn: () => apiFetch<AgentDetailAggregate>(getAdminApiPath("agents", agentId as string, "detail")),
    enabled: Boolean(agentId),
    ...options,
  });
}

export function useCreateVersion(
  agentId: string,
  options?: UseMutationOptions<
    unknown,
    unknown,
    { instructions?: string; tools?: Record<string, unknown>; version?: number }
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiFetch(getAdminApiPath("agents", agentId, "versions"), {
        method: "POST",
        body: payload,
      }),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: agentQueryKeys.detail(agentId) });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useDeployVersion(
  agentId: string,
  options?: UseMutationOptions<unknown, unknown, { version: number }>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiFetch(getAdminApiPath("agents", agentId, "deploy"), {
        method: "POST",
        body: payload,
      }),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: agentQueryKeys.detail(agentId) });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

type UploadInput = File | { file: File; title?: string };

export function useUploadAgentDocument(
  agentId: string,
  options?: UseMutationOptions<unknown, unknown, UploadInput>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const payload = input instanceof File ? { file: input, title: input.name } : input;
      const form = new FormData();
      form.append("file", payload.file);
      if (payload.title) form.append("title", payload.title);
      return apiFetch(getAdminApiPath("agents", agentId, "documents", "upload"), {
        method: "POST",
        body: form,
      });
    },
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: agentQueryKeys.detail(agentId) });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useDeleteAgentDocument(
  agentId: string,
  options?: UseMutationOptions<unknown, unknown, string>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) =>
      apiFetch(getAdminApiPath("agents", agentId, "documents", docId), { method: "DELETE" }),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: agentQueryKeys.detail(agentId) });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useAddAgentDocUrl(
  agentId: string,
  options?: UseMutationOptions<unknown, unknown, { title?: string; url: string }>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiFetch(getAdminApiPath("agents", agentId, "documents", "url"), {
        method: "POST",
        body: payload,
      }),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: agentQueryKeys.detail(agentId) });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useEmbedAllAgentDocs(
  agentId: string,
  options?: UseMutationOptions<unknown, unknown, { include_ready?: boolean } | undefined>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiFetch(getAdminApiPath("agents", agentId, "documents", "embed_all"), {
        method: "POST",
        body: payload ?? {},
      }),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: agentQueryKeys.detail(agentId) });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useDriveSyncAgentDocs(
  agentId: string,
  options?: UseMutationOptions<unknown, unknown, { folder: string }>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiFetch(getAdminApiPath("agents", agentId, "documents", "drive_sync"), {
        method: "POST",
        body: payload,
      }),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: agentQueryKeys.detail(agentId) });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useWebSearchImportAgentDocs(
  agentId: string,
  options?: UseMutationOptions<unknown, unknown, { query: string; top_n?: number; provider?: string }>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiFetch(getAdminApiPath("agents", agentId, "documents", "web_search"), {
        method: "POST",
        body: payload,
      }),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: agentQueryKeys.detail(agentId) });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useEmbedAgentDocument(
  agentId: string,
  options?: UseMutationOptions<unknown, unknown, string>,
) {
  return useMutation({
    mutationFn: (docId: string) =>
      apiFetch(getAdminApiPath("agents", agentId, "documents", docId, "embed"), {
        method: "POST",
      }),
    ...options,
  });
}

export function useAgentTasks(
  agentId: string,
  params?: { status?: string },
  options?: UseQueryOptions<AgentTasksResponse, unknown, AgentTasksResponse>,
) {
  return useQuery({
    queryKey: agentQueryKeys.tasks(agentId),
    queryFn: () => {
      const search = new URLSearchParams();
      if (params?.status) search.set("status", params.status);
      const path = search.size
        ? `${getAdminApiPath("agents", agentId, "tasks")}?${search.toString()}`
        : getAdminApiPath("agents", agentId, "tasks");
      return apiFetch<AgentTasksResponse>(path);
    },
    enabled: Boolean(agentId),
    ...options,
  });
}

export function useAgentRuns(
  agentId: string,
  params?: { status?: string; limit?: number },
  options?: UseQueryOptions<AgentRunsResponse, unknown, AgentRunsResponse>,
) {
  return useQuery({
    queryKey: agentQueryKeys.runs(agentId, params),
    queryFn: () => {
      const search = new URLSearchParams();
      if (params?.status) search.set("status", params.status);
      if (params?.limit) search.set("limit", String(params.limit));
      const path = search.size
        ? `${getAdminApiPath("agents", agentId, "runs")}?${search.toString()}`
        : getAdminApiPath("agents", agentId, "runs");
      return apiFetch<AgentRunsResponse>(path);
    },
    enabled: Boolean(agentId),
    ...options,
  });
}

export function useAgentRunDetails(
  agentId: string,
  runId?: string | null,
  options?: UseQueryOptions<AgentRunDetailResponse, unknown, AgentRunDetailResponse>,
) {
  return useQuery({
    queryKey: agentQueryKeys.runDetail(agentId, runId ?? "unknown"),
    queryFn: () =>
      apiFetch<AgentRunDetailResponse>(getAdminApiPath("agents", agentId, "runs", runId as string)),
    enabled: Boolean(agentId && runId),
    ...options,
  });
}

export function useAgentAudit(
  agentId: string,
  options?: UseQueryOptions<AgentAuditResponse, unknown, AgentAuditResponse>,
) {
  return useQuery({
    queryKey: agentQueryKeys.audit(agentId),
    queryFn: () => apiFetch<AgentAuditResponse>(getAdminApiPath("agents", agentId, "audit")),
    enabled: Boolean(agentId),
    ...options,
  });
}

export function useSearchAgentKnowledge(
  agentId: string,
  options?: UseMutationOptions<unknown, unknown, { query: string; top_k?: number }>,
) {
  return useMutation({
    mutationFn: (payload) =>
      apiFetch(getAdminApiPath("agents", agentId, "search"), {
        method: "POST",
        body: payload,
      }),
    ...options,
  });
}
