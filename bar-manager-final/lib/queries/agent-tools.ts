import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

export type AgentTool = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  parameters: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type AgentToolsResponse = {
  tools: AgentTool[];
  integration?: {
    status: "ok" | "degraded";
    target: string;
    message?: string;
  };
};

export type AgentToolTestResult = {
  status: "ok" | "error" | "mock";
  tool?: string;
  httpStatus?: number;
  response?: unknown;
  echo?: Record<string, unknown>;
  message?: string;
};

export type AgentToolTestResponse = {
  result: AgentToolTestResult;
};

export function useAgentTools() {
  return useQuery({
    queryKey: ["agent-tools"],
    queryFn: ({ signal }) =>
      apiClient.fetch<AgentToolsResponse>("agentTools", { signal }),
  });
}

export function useUpdateAgentTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      toolId,
      data,
    }: {
      toolId: string;
      data: Partial<Pick<AgentTool, "description" | "enabled" | "parameters" | "metadata">>;
    }) =>
      apiClient.fetch("agentTool", {
        method: "PATCH",
        body: { toolId, ...data },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-tools"] });
    },
  });
}

export function useTestAgentTool() {
  return useMutation({
    mutationFn: ({
      toolId,
      payload,
    }: {
      toolId: string;
      payload: Record<string, unknown>;
    }) =>
      apiClient.fetch<AgentToolTestResponse>("agentToolTestCall", {
        method: "POST",
        body: { toolId, payload },
      }),
  });
}
