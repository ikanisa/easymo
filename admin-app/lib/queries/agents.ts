import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminApiRoutePath } from "@/lib/routes";

export function useAgentsList() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch(getAdminApiRoutePath("agents"));
      if (!res.ok) throw new Error("failed_to_load_agents");
      return res.json();
    },
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; key?: string; description?: string }) => {
      const res = await fetch(getAdminApiRoutePath("agents"), {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("failed_to_create_agent");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

type AgentDetailsResponse = {
  agent: Record<string, unknown> | null;
  versions: any[];
  documents: {
    id: string;
    title: string;
    created_at: string;
    embedding_status?: string | null;
    source_url?: string | null;
    storage_path?: string | null;
  }[];
  deployments?: any[];
  knowledgeStats?: {
    total: number;
    ready: number;
    processing: number;
    pending: number;
    failed: number;
    other: number;
  };
};

export function useAgentDetails(id: string) {
  return useQuery<AgentDetailsResponse>({
    queryKey: ["agents", id],
    queryFn: async () => {
      const res = await fetch(getAdminApiRoutePath("agentDetail", { agentId: id }));
      if (!res.ok) throw new Error("failed_to_load_agent");
      return res.json();
    },
    refetchInterval: (data) => {
      const documents = data?.documents ?? [];
      const hasPending = documents.some((doc) => {
        const status = (doc.embedding_status ?? "pending").toLowerCase();
        return status !== "ready";
      });
      return hasPending ? 5000 : false;
    },
  });
}

export function useCreateVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { instructions?: string; config?: Record<string, unknown> }) => {
      const res = await fetch(getAdminApiRoutePath("agentVersions", { agentId: id }), {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("failed_to_create_version");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents", id] }),
  });
}

export function useDeployVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { version: number; environment?: "staging" | "production" }) => {
      const res = await fetch(getAdminApiRoutePath("agentDeploy", { agentId: id }), {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("failed_to_deploy");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents", id] }),
  });
}

export function useUploadAgentDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(getAdminApiRoutePath("agentDocumentsUpload", { agentId: id }), {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("failed_to_upload_document");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents", id] }),
  });
}

export function useDeleteAgentDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(
        getAdminApiRoutePath("agentDocument", { agentId: id, documentId: docId }),
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error("failed_to_delete_document");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents", id] }),
  });
}

export function useAgentTasks(id: string, params?: { status?: string }) {
  const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : "";
  return useQuery({
    queryKey: ["agents", id, "tasks", params?.status ?? "all"],
    queryFn: async () => {
      const res = await fetch(`${getAdminApiRoutePath("agentTasks", { agentId: id })}${qs}`);
      if (!res.ok) throw new Error("failed_to_load_tasks");
      return res.json();
    },
  });
}

export function useAgentRuns(id: string, params?: { status?: string }) {
  const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : "";
  return useQuery({
    queryKey: ["agents", id, "runs", params?.status ?? "all"],
    queryFn: async () => {
      const res = await fetch(`${getAdminApiRoutePath("agentRuns", { agentId: id })}${qs}`);
      if (!res.ok) throw new Error("failed_to_load_runs");
      return res.json();
    },
  });
}
