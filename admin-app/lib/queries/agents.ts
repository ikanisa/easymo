import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export function useAgentsList() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: ({ signal }) => apiClient.fetch("agents", { signal }),
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; key?: string; description?: string }) =>
      apiClient.fetch("agents", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useAgentDetails(id: string) {
  return useQuery({
    queryKey: ["agents", id],
    queryFn: ({ signal }) =>
      apiClient.fetch("agentDetail", { params: { agentId: id }, signal }),
  });
}

export function useCreateVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { instructions?: string; config?: Record<string, unknown> }) =>
      apiClient.fetch("agentVersions", {
        params: { agentId: id },
        method: "POST",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", id] });
      qc.invalidateQueries({ queryKey: ["agents", id, "versions"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "detail"] });
    },
  });
}

export function useDeployVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { version: number }) =>
      apiClient.fetch("agentDeploy", {
        params: { agentId: id },
        method: "POST",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", id] });
      qc.invalidateQueries({ queryKey: ["agents", id, "versions"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "detail"] });
    },
  });
}

export function useUploadAgentDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiClient.fetch("agentDocumentsUpload", {
        params: { agentId: id },
        method: "POST",
        body: fd,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", id] });
      qc.invalidateQueries({ queryKey: ["agents", id, "documents"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "vectors", "stats"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "detail"] });
    },
  });
}

export function useDeleteAgentDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) =>
      apiClient.fetch("agentDocument", {
        params: { agentId: id, documentId: docId },
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", id] });
      qc.invalidateQueries({ queryKey: ["agents", id, "documents"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "vectors", "stats"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "detail"] });
    },
  });
}

export function useAgentTasks(id: string, params?: { status?: string }) {
  return useQuery({
    queryKey: ["agents", id, "tasks", params?.status ?? "all"],
    queryFn: ({ signal }) =>
      apiClient.fetch("agentTasks", {
        params: { agentId: id },
        query: { status: params?.status },
        signal,
      }),
  });
}

export function useAgentRuns(id: string, params?: { status?: string }) {
  return useQuery({
    queryKey: ["agents", id, "runs", params?.status ?? "all"],
    queryFn: ({ signal }) =>
      apiClient.fetch("agentRuns", {
        params: { agentId: id },
        query: { status: params?.status },
        signal,
      }),
  });
}

export function useAgentRunDetails(id: string, runId: string) {
  return useQuery({
    enabled: Boolean(id && runId),
    queryKey: ["agents", id, "runs", runId],
    queryFn: ({ signal }) =>
      apiClient.fetch("agentRunDetail", {
        params: { agentId: id, runId },
        signal,
      }),
  });
}

export function useAgentAudit(id: string) {
  return useQuery({
    queryKey: ["agents", id, "audit"],
    queryFn: ({ signal }) =>
      apiClient.fetch("agentAudit", { params: { agentId: id }, signal }),
  });
}

export function useAgentDetailAggregate(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ["agents", id, "detail"],
    queryFn: ({ signal }) =>
      apiClient.fetch("agentDetailAggregate", {
        params: { agentId: id },
        signal,
      }),
  });
}

export function useAgentVersions(id: string) {
  return useQuery({
    queryKey: ["agents", id, "versions"],
    queryFn: ({ signal }) =>
      apiClient.fetch("agentVersions", {
        params: { agentId: id },
        signal,
      }),
  });
}

export function useAgentDocuments(id: string) {
  return useQuery({
    queryKey: ["agents", id, "documents"],
    queryFn: ({ signal }) =>
      apiClient.fetch("agentDocuments", {
        params: { agentId: id },
        signal,
      }),
  });
}

export function useAgentVectorStats(id: string) {
  return useQuery({
    queryKey: ["agents", id, "vectors", "stats"],
    queryFn: ({ signal }) =>
      apiClient.fetch("agentVectorStats", {
        params: { agentId: id },
        signal,
      }),
  });
}

export function useAddAgentDocUrl(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string; url: string }) =>
      apiClient.fetch("agentDocumentsUrl", {
        params: { agentId: id },
        method: "POST",
        body,
      }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["agents", id, "detail"] });
      const previous = qc.getQueryData(["agents", id, "detail"]);
      const tempId = `temp:url:${Date.now()}`;
      qc.setQueryData(["agents", id, "detail"], (old: any) => {
        const docs = Array.isArray(old?.documents) ? old.documents.slice() : [];
        docs.unshift({
          id: tempId,
          agent_id: id,
          title: (body?.title && String(body.title)) || String(body?.url || "Untitled URL"),
          source_url: String(body?.url || ""),
          storage_path: null,
          embedding_status: 'pending',
          metadata: { __temp: true },
          created_at: new Date().toISOString(),
        });
        return { ...(old || {}), documents: docs };
      });
      return { previous } as { previous: unknown };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["agents", id, "detail"], ctx.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", id, "documents"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "vectors", "stats"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "detail"] });
    }
  });
}

export function useEmbedAllAgentDocs(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { include_ready?: boolean }) =>
      apiClient.fetch("agentDocumentsEmbedAll", {
        params: { agentId: id },
        method: "POST",
        body,
      }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["agents", id, "detail"] });
      const previous = qc.getQueryData(["agents", id, "detail"]);
      qc.setQueryData(["agents", id, "detail"], (old: any) => {
        if (!old?.documents) return old;
        const docs = old.documents.map((d: any) => (
          d.embedding_status && d.embedding_status !== 'ready' ? { ...d, embedding_status: 'processing' } : d
        ));
        return { ...old, documents: docs };
      });
      return { previous } as { previous: unknown };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["agents", id, "detail"], ctx.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", id, "documents"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "vectors", "stats"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "detail"] });
    }
  });
}

export function useDriveSyncAgentDocs(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { folder: string; page_size?: number }) =>
      apiClient.fetch("agentDocumentsDriveSync", {
        params: { agentId: id },
        method: "POST",
        body,
      }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["agents", id, "detail"] });
      const previous = qc.getQueryData(["agents", id, "detail"]);
      const tempId = `temp:drive:${Date.now()}`;
      qc.setQueryData(["agents", id, "detail"], (old: any) => {
        const docs = Array.isArray(old?.documents) ? old.documents.slice() : [];
        docs.unshift({
          id: tempId,
          agent_id: id,
          title: `Drive import: ${(body?.folder || '').toString().slice(0, 40)}`,
          source_url: null,
          storage_path: null,
          embedding_status: 'pending',
          metadata: { __temp: true },
          created_at: new Date().toISOString(),
        });
        return { ...(old || {}), documents: docs };
      });
      return { previous } as { previous: unknown };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["agents", id, "detail"], ctx.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", id, "documents"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "detail"] });
    }
  });
}

export function useWebSearchImportAgentDocs(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { query: string; top_n?: number; provider?: "bing" | "serpapi" }) =>
      apiClient.fetch("agentDocumentsWebSearch", {
        params: { agentId: id },
        method: "POST",
        body,
      }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["agents", id, "detail"] });
      const previous = qc.getQueryData(["agents", id, "detail"]);
      const tempId = `temp:web:${Date.now()}`;
      qc.setQueryData(["agents", id, "detail"], (old: any) => {
        const docs = Array.isArray(old?.documents) ? old.documents.slice() : [];
        docs.unshift({
          id: tempId,
          agent_id: id,
          title: `Web import: ${(body?.query || '').toString().slice(0, 60)}`,
          source_url: null,
          storage_path: null,
          embedding_status: 'pending',
          metadata: { __temp: true },
          created_at: new Date().toISOString(),
        });
        return { ...(old || {}), documents: docs };
      });
      return { previous } as { previous: unknown };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["agents", id, "detail"], ctx.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", id, "documents"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "detail"] });
    }
  });
}

export function useEmbedAgentDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) =>
      apiClient.fetch("agentDocumentEmbed", {
        params: { agentId: id, documentId: docId },
        method: "POST",
      }),
    onMutate: async (docId: string) => {
      await qc.cancelQueries({ queryKey: ["agents", id, "detail"] });
      const previous = qc.getQueryData(["agents", id, "detail"]);
      qc.setQueryData(["agents", id, "detail"], (old: any) => {
        if (!old?.documents) return old;
        const docs = old.documents.map((d: any) => d.id === docId ? { ...d, embedding_status: 'processing' } : d);
        return { ...old, documents: docs };
      });
      return { previous } as { previous: unknown };
    },
    onError: (_err, _docId, ctx) => {
      if (ctx?.previous) qc.setQueryData(["agents", id, "detail"], ctx.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", id, "documents"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "vectors", "stats"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "detail"] });
    }
  });
}

export function useSearchAgentKnowledge(id: string) {
  return useMutation({
    mutationFn: (body: { query: string; top_k?: number }) =>
      apiClient.fetch("agentSearch", {
        params: { agentId: id },
        method: "POST",
        body,
      }),
  });
}
