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

export function useAgentDetails(id: string) {
  return useQuery({
    queryKey: ["agents", id],
    queryFn: async () => {
      const res = await fetch(getAdminApiRoutePath("agentDetail", { agentId: id }));
      if (!res.ok) throw new Error("failed_to_load_agent");
      return res.json();
    },
  });
}

export function useCreateVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { instructions?: string; config?: Record<string, unknown> }) => {
      const res = await fetch(
        getAdminApiRoutePath("agentVersions", { agentId: id }),
        { method: "POST", body: JSON.stringify(body) },
      );
      if (!res.ok) throw new Error("failed_to_create_version");
      return res.json();
    },
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
    mutationFn: async (body: { version: number }) => {
      const res = await fetch(
        getAdminApiRoutePath("agentDeploy", { agentId: id }),
        { method: "POST", body: JSON.stringify(body) },
      );
      if (!res.ok) throw new Error("failed_to_deploy");
      return res.json();
    },
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
      const res = await fetch(getAdminApiRoutePath("agentDocumentsUpload", { agentId: id }), {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("failed_to_upload_document");
      return res.json();
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", id] });
      qc.invalidateQueries({ queryKey: ["agents", id, "documents"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "vectors", "stats"] });
      qc.invalidateQueries({ queryKey: ["agents", id, "detail"] });
    },
  });
}

export function useAgentTasks(id: string, params?: { status?: string }) {
  const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : "";
  return useQuery({
    queryKey: ["agents", id, "tasks", params?.status ?? "all"],
    queryFn: async () => {
      const baseUrl = getAdminApiRoutePath("agentTasks", { agentId: id });
      const res = await fetch(`${baseUrl}${qs}`);
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
      const baseUrl = getAdminApiRoutePath("agentRuns", { agentId: id });
      const res = await fetch(`${baseUrl}${qs}`);
      if (!res.ok) throw new Error("failed_to_load_runs");
      return res.json();
    },
  });
}

export function useAgentRunDetails(id: string, runId: string) {
  return useQuery({
    enabled: Boolean(id && runId),
    queryKey: ["agents", id, "runs", runId],
    queryFn: async () => {
      const res = await fetch(getAdminApiRoutePath("agentRunDetail", { agentId: id, runId }));
      if (!res.ok) throw new Error("failed_to_load_run");
      return res.json();
    },
  });
}

export function useAgentAudit(id: string) {
  return useQuery({
    queryKey: ["agents", id, "audit"],
    queryFn: async () => {
      const res = await fetch(getAdminApiRoutePath("agentAudit", { agentId: id }));
      if (!res.ok) throw new Error("failed_to_load_audit");
      return res.json();
    },
  });
}

export function useAgentDetailAggregate(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ["agents", id, "detail"],
    queryFn: async () => {
      const res = await fetch(getAdminApiRoutePath("agentDetailAggregate", { agentId: id }));
      if (!res.ok) throw new Error("failed_to_load_agent_detail");
      return res.json();
    },
  });
}

export function useAgentVersions(id: string) {
  return useQuery({
    queryKey: ["agents", id, "versions"],
    queryFn: async () => {
      const res = await fetch(getAdminApiRoutePath("agentVersions", { agentId: id }));
      if (!res.ok) throw new Error("failed_to_load_versions");
      return res.json();
    },
  });
}

export function useAgentDocuments(id: string) {
  return useQuery({
    queryKey: ["agents", id, "documents"],
    queryFn: async () => {
      const res = await fetch(getAdminApiRoutePath("agentDocuments", { agentId: id }));
      if (!res.ok) throw new Error("failed_to_load_documents");
      return res.json();
    },
  });
}

export function useAgentVectorStats(id: string) {
  return useQuery({
    queryKey: ["agents", id, "vectors", "stats"],
    queryFn: async () => {
      const res = await fetch(getAdminApiRoutePath("agentVectorStats", { agentId: id }));
      if (!res.ok) throw new Error("failed_to_load_vector_stats");
      return res.json();
    },
  });
}

export function useAddAgentDocUrl(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title?: string; url: string }) => {
      const res = await fetch(
        getAdminApiRoutePath("agentDocumentsUrl", { agentId: id }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error('failed_to_add_url');
      return res.json();
    },
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
    mutationFn: async (body: { include_ready?: boolean }) => {
      const res = await fetch(
        getAdminApiRoutePath("agentDocumentsEmbedAll", { agentId: id }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error('failed_to_embed_all');
      return res.json();
    },
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
    mutationFn: async (body: { folder: string; page_size?: number }) => {
      const res = await fetch(
        getAdminApiRoutePath("agentDocumentsDriveSync", { agentId: id }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error('failed_to_drive_sync');
      return res.json();
    },
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
    mutationFn: async (body: { query: string; top_n?: number; provider?: 'bing' | 'serpapi' }) => {
      const res = await fetch(
        getAdminApiRoutePath("agentDocumentsWebSearch", { agentId: id }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error('failed_to_web_import');
      return res.json();
    },
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
    mutationFn: async (docId: string) => {
      const res = await fetch(
        getAdminApiRoutePath("agentDocumentEmbed", { agentId: id, documentId: docId }),
        { method: "POST" },
      );
      if (!res.ok) throw new Error('failed_to_embed_doc');
      return res.json();
    },
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
    mutationFn: async (body: { query: string; top_k?: number }) => {
      const res = await fetch(
        getAdminApiRoutePath("agentSearch", { agentId: id }),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error('failed_to_search');
      return res.json();
    },
  });
}
