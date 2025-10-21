import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useAgentsList() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("failed_to_load_agents");
      return res.json();
    },
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; key?: string; description?: string }) => {
      const res = await fetch("/api/agents", { method: "POST", body: JSON.stringify(body) });
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
      const res = await fetch(`/api/agents/${id}`);
      if (!res.ok) throw new Error("failed_to_load_agent");
      return res.json();
    },
  });
}

export function useCreateVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { instructions?: string; config?: Record<string, unknown> }) => {
      const res = await fetch(`/api/agents/${id}/versions`, { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) throw new Error("failed_to_create_version");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents", id] }),
  });
}

export function useDeployVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { version: number }) => {
      const res = await fetch(`/api/agents/${id}/deploy`, { method: "POST", body: JSON.stringify(body) });
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
      const res = await fetch(`/api/agents/${id}/documents/upload`, {
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
      const res = await fetch(`/api/agents/${id}/documents/${docId}`, {
        method: "DELETE",
      });
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
      const res = await fetch(`/api/agents/${id}/tasks${qs}`);
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
      const res = await fetch(`/api/agents/${id}/runs${qs}`);
      if (!res.ok) throw new Error("failed_to_load_runs");
      return res.json();
    },
  });
}
