"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";
import {
  useAgentsList,
  useAgentDetailAggregate,
  useAgentRuns,
  useAgentTasks,
  useAgentAudit,
  useUploadAgentDocument,
  useEmbedAllAgentDocs,
  useEmbedAgentDocument,
  useUpdateAgentDocument,
  useUpdateAgentTask,
} from "@/lib/queries/agents";
import { getAdminApiRoutePath } from "@/lib/routes";

type AgentPersona = {
  id: string;
  name: string;
  status: string;
  tags?: string[] | null;
};

export default function InsuranceKnowledgePage() {
  const agentsList = useAgentsList();
  const { pushToast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const insuranceAgents = useMemo(() => {
    const agents = (agentsList.data?.agents as AgentPersona[] | undefined) ?? [];
    if (!agents.length) return [] as AgentPersona[];
    const filtered = agents.filter((agent) => {
      const tags = agent.tags ?? [];
      return (
        tags.some((tag) => tag.toLowerCase().includes("insurance")) ||
        agent.name.toLowerCase().includes("insurance")
      );
    });
    return filtered.length ? filtered : agents;
  }, [agentsList.data?.agents]);

  useEffect(() => {
    if (!selectedAgentId && insuranceAgents.length) {
      setSelectedAgentId(insuranceAgents[0]?.id ?? null);
    }
  }, [insuranceAgents, selectedAgentId]);

  const agentId = selectedAgentId ?? "";
  const detailQuery = useAgentDetailAggregate(agentId);
  const runsQuery = useAgentRuns(agentId, { limit: 100 });
  const tasksQuery = useAgentTasks(agentId);
  const auditQuery = useAgentAudit(agentId);
  const uploadMutation = useUploadAgentDocument(agentId);
  const embedAllMutation = useEmbedAllAgentDocs(agentId);
  const embedDocMutation = useEmbedAgentDocument(agentId);
  const updateDocument = useUpdateAgentDocument(agentId);
  const updateTask = useUpdateAgentTask(agentId);

  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState<string>("");
  const [titleEditId, setTitleEditId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState<string>("");

  const handleUploadFile = async (file: File | null) => {
    if (!file) return;
    try {
      await uploadMutation.mutateAsync(file);
      pushToast(`Uploaded ${file.name}`, "success");
    } catch (error) {
      pushToast(
        `Upload failed – ${error instanceof Error ? error.message : "unexpected error"}`,
        "error",
      );
    }
  };

  const handleDocumentPreview = async (documentId: string) => {
    try {
      const res = await fetch(
        getAdminApiRoutePath("agentDocumentSigned", { agentId, documentId }),
      );
      const json = await res.json();
      if (!res.ok || !json?.url) throw new Error(json?.error ?? "Preview unavailable");
      window.open(json.url as string, "_blank", "noopener,noreferrer");
    } catch (error) {
      pushToast(
        `Preview failed – ${error instanceof Error ? error.message : "unexpected error"}`,
        "error",
      );
    }
  };

  const handleUpdateTags = async (documentId: string, value: string) => {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    try {
      await updateDocument.mutateAsync({ documentId, data: { tags } });
      pushToast("Tags updated", "success");
    } catch (error) {
      pushToast(
        `Update failed – ${error instanceof Error ? error.message : "unexpected error"}`,
        "error",
      );
    }
  };

  const handleRenameDocument = async (documentId: string, value: string) => {
    if (!value.trim()) {
      pushToast("Title cannot be empty", "error");
      return;
    }
    try {
      await updateDocument.mutateAsync({ documentId, data: { title: value.trim() } });
      pushToast("Title updated", "success");
    } catch (error) {
      pushToast(
        `Rename failed – ${error instanceof Error ? error.message : "unexpected error"}`,
        "error",
      );
    }
  };

  const handleTaskStatus = async (taskId: string, status: string) => {
    try {
      await updateTask.mutateAsync({ taskId, data: { status } });
      pushToast(`Task marked as ${status}`, "success");
    } catch (error) {
      pushToast(
        `Task update failed – ${error instanceof Error ? error.message : "unexpected error"}`,
        "error",
      );
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Insurance Knowledge Corpus"
        description="Manage prompts, embeddings, and operational tasks feeding the insurance support agent."
      />

      <SectionCard
        title="Persona selection"
        description="Choose which agent persona to inspect. Insurance-tagged personas are prioritised."
      >
        {agentsList.isLoading ? (
          <div className="text-sm text-[color:var(--color-muted)]">Loading personas…</div>
        ) : insuranceAgents.length === 0 ? (
          <div className="text-sm text-[color:var(--color-muted)]">
            No personas found. Create an agent persona first.
          </div>
        ) : (
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <label className="flex flex-col text-sm text-[color:var(--color-muted)]">
              Active persona
              <select
                value={selectedAgentId ?? ""}
                onChange={(event) => setSelectedAgentId(event.target.value || null)}
                className="mt-1 max-w-xs rounded-lg border border-[color:var(--color-border)]/50 bg-white px-3 py-2 text-sm"
              >
                {insuranceAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-3 text-xs text-[color:var(--color-muted)]">
              <span>
                Personas loaded: {insuranceAgents.length}
              </span>
              {selectedAgentId && (
                <span>
                  Status: {detailQuery.data?.agent?.status ?? "unknown"}
                </span>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {agentId ? (
        <div className="space-y-6">
          <SectionCard
            title="Prompts & instructions"
            description="Track the evolution of the system prompt and rollout-ready instruction sets."
          >
            {detailQuery.isLoading ? (
              <div className="text-sm text-[color:var(--color-muted)]">Loading prompts…</div>
            ) : detailQuery.data?.versions?.length ? (
              <div className="space-y-4">
                {detailQuery.data.versions.slice(0, 5).map((version: any) => (
                  <article
                    key={version.id}
                    className="rounded-xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/60 p-4"
                  >
                    <header className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span>v{version.version}</span>
                        <Badge variant={version.published ? "green" : "blue"}>
                          {version.status ?? (version.published ? "published" : "draft")}
                        </Badge>
                      </div>
                      <time className="text-xs text-[color:var(--color-muted)]">
                        {new Date(version.created_at).toLocaleString()}
                      </time>
                    </header>
                    <pre className="whitespace-pre-wrap rounded-lg bg-white/70 p-4 text-xs text-[color:var(--color-foreground)] shadow-sm">
                      {version.instructions || "No instructions recorded."}
                    </pre>
                  </article>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[color:var(--color-muted)]">
                No prompt history yet. Create a version to seed instructions.
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Knowledge documents"
            description="Upload PDFs or text files, tag them, and trigger embedding refreshes."
            actions={
              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-lg border border-dashed border-[color:var(--color-border)]/60 px-3 py-2 text-sm text-[color:var(--color-muted)] hover:border-[color:var(--color-border)]">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(event) => handleUploadFile(event.target.files?.[0] ?? null)}
                  />
                  Upload document
                </label>
                <button
                  type="button"
                  onClick={() =>
                    embedAllMutation.mutate(
                      { include_ready: false },
                      {
                        onSuccess: (result: any) => {
                          const ok = result?.ok ?? 0;
                          const fail = result?.fail ?? 0;
                          pushToast(`Re-index triggered (${ok} queued, ${fail} failed)`, "success");
                        },
                        onError: (error) => {
                          pushToast(
                            `Embed all failed – ${error instanceof Error ? error.message : "unexpected error"}`,
                            "error",
                          );
                        },
                      },
                    )
                  }
                  className="rounded-lg border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--color-foreground)] shadow-sm transition hover:bg-[color:var(--color-surface)]"
                  disabled={embedAllMutation.isPending}
                >
                  {embedAllMutation.isPending ? "Re-indexing…" : "Re-index all"}
                </button>
              </div>
            }
          >
            {detailQuery.isLoading ? (
              <div className="text-sm text-[color:var(--color-muted)]">Loading documents…</div>
            ) : detailQuery.data?.documents?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Tags</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailQuery.data.documents.map((doc: any) => {
                      const tags = Array.isArray(doc.metadata?.tags) ? doc.metadata.tags : [];
                      return (
                        <tr key={doc.id} className="border-b last:border-none">
                          <td className="px-3 py-3 align-top">
                            {titleEditId === doc.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  value={titleDraft}
                                  onChange={(event) => setTitleDraft(event.target.value)}
                                  className="flex-1 rounded border border-[color:var(--color-border)] px-2 py-1 text-sm"
                                />
                                <button
                                  type="button"
                                  className="rounded border border-[color:var(--color-border)] bg-white px-2 py-1 text-xs"
                                  onClick={() => {
                                    handleRenameDocument(doc.id, titleDraft);
                                    setTitleEditId(null);
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-transparent px-2 py-1 text-xs text-[color:var(--color-muted)]"
                                  onClick={() => setTitleEditId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[color:var(--color-foreground)]">
                                  {doc.title}
                                </span>
                                <button
                                  type="button"
                                  className="text-xs text-[color:var(--color-muted)] underline"
                                  onClick={() => {
                                    setTitleEditId(doc.id);
                                    setTitleDraft(doc.title ?? "");
                                  }}
                                >
                                  Rename
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top">
                            {tagEditId === doc.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  value={tagDraft}
                                  onChange={(event) => setTagDraft(event.target.value)}
                                  placeholder="claim, underwriting"
                                  className="flex-1 rounded border border-[color:var(--color-border)] px-2 py-1 text-sm"
                                />
                                <button
                                  type="button"
                                  className="rounded border border-[color:var(--color-border)] bg-white px-2 py-1 text-xs"
                                  onClick={() => {
                                    handleUpdateTags(doc.id, tagDraft);
                                    setTagEditId(null);
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="rounded border border-transparent px-2 py-1 text-xs text-[color:var(--color-muted)]"
                                  onClick={() => setTagEditId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : tags.length ? (
                              <div className="flex flex-wrap gap-1">
                                {tags.map((tag: string) => (
                                  <Badge key={tag} variant="blue">
                                    {tag}
                                  </Badge>
                                ))}
                                <button
                                  type="button"
                                  className="text-xs text-[color:var(--color-muted)] underline"
                                  onClick={() => {
                                    setTagEditId(doc.id);
                                    setTagDraft(tags.join(", "));
                                  }}
                                >
                                  Edit
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="text-xs text-[color:var(--color-muted)] underline"
                                onClick={() => {
                                  setTagEditId(doc.id);
                                  setTagDraft("");
                                }}
                              >
                                Add tags
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <Badge
                              variant={
                                doc.embedding_status === "ready"
                                  ? "green"
                                  : doc.embedding_status === "failed"
                                  ? "red"
                                  : "yellow"
                              }
                            >
                              {doc.embedding_status ?? "pending"}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 align-top text-xs text-[color:var(--color-muted)]">
                            {doc.source_url ? (
                              <a
                                href={doc.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                              >
                                Source
                              </a>
                            ) : doc.storage_path ? (
                              <code>{doc.storage_path}</code>
                            ) : (
                              <span>Uploaded</span>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top text-xs text-[color:var(--color-muted)]">
                            {new Date(doc.created_at).toLocaleString()}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                className="rounded border border-[color:var(--color-border)] bg-white px-2 py-1 text-xs"
                                onClick={() => handleDocumentPreview(doc.id)}
                              >
                                Preview
                              </button>
                              <button
                                type="button"
                                className="rounded border border-[color:var(--color-border)] bg-white px-2 py-1 text-xs"
                                onClick={() =>
                                  embedDocMutation.mutate(doc.id, {
                                    onSuccess: () => pushToast("Re-index requested", "success"),
                                    onError: (error) =>
                                      pushToast(
                                        `Re-index failed – ${
                                          error instanceof Error ? error.message : "unexpected error"
                                        }`,
                                        "error",
                                      ),
                                  })
                                }
                                disabled={embedDocMutation.isPending}
                              >
                                Re-index
                              </button>
                              {doc.embedding_status === "failed" ? (
                                <button
                                  type="button"
                                  className="rounded border border-[color:var(--color-border)] bg-white px-2 py-1 text-xs text-red-600"
                                  onClick={() =>
                                    embedDocMutation.mutate(doc.id, {
                                      onSuccess: () => pushToast("Retry queued", "success"),
                                      onError: (error) =>
                                        pushToast(
                                          `Retry failed – ${
                                            error instanceof Error ? error.message : "unexpected error"
                                          }`,
                                          "error",
                                        ),
                                    })
                                  }
                                  disabled={embedDocMutation.isPending}
                                >
                                  Retry
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-[color:var(--color-muted)]">
                No documents yet. Upload PDFs, DOCX, or text files to seed the knowledge base.
              </div>
            )}
            {detailQuery.data?.vectorStats ? (
              <footer className="mt-4 flex flex-wrap gap-4 text-xs text-[color:var(--color-muted)]">
                <span>
                  Ready docs: {detailQuery.data.vectorStats.readyDocs}/
                  {detailQuery.data.vectorStats.totalDocs}
                </span>
                <span>JSON chunks: {detailQuery.data.vectorStats.jsonChunks}</span>
                <span>Vector chunks: {detailQuery.data.vectorStats.vecChunks}</span>
              </footer>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Learning feedback"
            description="Recent agent runs, customer feedback notes, and summarised outputs."
          >
            {runsQuery.isLoading ? (
              <div className="text-sm text-[color:var(--color-muted)]">Loading activity…</div>
            ) : runsQuery.data?.runs?.length ? (
              <div className="space-y-3">
                {runsQuery.data.runs.slice(0, 8).map((run: any) => {
                  const status = run.status ?? "queued";
                  const feedback = run.output?.feedback ?? run.output?.summary ?? null;
                  return (
                    <article
                      key={run.id}
                      className="rounded-xl border border-[color:var(--color-border)]/50 bg-[color:var(--color-surface)]/70 p-4"
                    >
                      <header className="mb-2 flex items-center justify-between text-xs text-[color:var(--color-muted)]">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              status === "succeeded"
                                ? "green"
                                : status === "failed"
                                ? "red"
                                : "yellow"
                            }
                          >
                            {status}
                          </Badge>
                          <span>{run.input?.topic ?? "Inbound request"}</span>
                        </div>
                        <time>{new Date(run.created_at).toLocaleString()}</time>
                      </header>
                      <div className="space-y-2 text-sm text-[color:var(--color-foreground)]">
                        {run.input?.prompt ? (
                          <p className="rounded-lg bg-white/70 p-3 text-xs">
                            <strong className="font-medium">Prompt:</strong> {run.input.prompt}
                          </p>
                        ) : null}
                        {feedback ? (
                          <p className="rounded-lg bg-emerald-50/80 p-3 text-xs">
                            <strong className="font-medium">Feedback:</strong> {String(feedback)}
                          </p>
                        ) : null}
                        {run.output?.response ? (
                          <p className="rounded-lg bg-white/60 p-3 text-xs">
                            <strong className="font-medium">Response:</strong> {run.output.response}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-[color:var(--color-muted)]">
                No recent runs captured yet.
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Operational tasks"
            description="Launch dry-runs, pause automations, or resume workflows feeding the insurance agent."
          >
            {tasksQuery.isLoading ? (
              <div className="text-sm text-[color:var(--color-muted)]">Loading tasks…</div>
            ) : tasksQuery.data?.tasks?.length ? (
              <div className="space-y-4">
                {tasksQuery.data.tasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/70 p-4"
                  >
                    <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-[color:var(--color-foreground)]">
                          {task.title ?? task.type ?? "Task"}
                        </h3>
                        <p className="text-xs text-[color:var(--color-muted)]">
                          Created {new Date(task.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            task.status === "running"
                              ? "blue"
                              : task.status === "completed"
                              ? "green"
                              : task.status === "failed"
                              ? "red"
                              : task.status === "dry_run"
                              ? "yellow"
                              : "slate"
                          }
                        >
                          {task.status}
                        </Badge>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded border border-[color:var(--color-border)] bg-white px-2 py-1 text-xs"
                            onClick={() => handleTaskStatus(task.id, "running")}
                            disabled={task.status === "running" || updateTask.isPending}
                          >
                            Start
                          </button>
                          <button
                            type="button"
                            className="rounded border border-[color:var(--color-border)] bg-white px-2 py-1 text-xs"
                            onClick={() => handleTaskStatus(task.id, "stopped")}
                            disabled={task.status === "stopped" || updateTask.isPending}
                          >
                            Stop
                          </button>
                          <button
                            type="button"
                            className="rounded border border-[color:var(--color-border)] bg-white px-2 py-1 text-xs"
                            onClick={() => handleTaskStatus(task.id, "dry_run")}
                            disabled={task.status === "dry_run" || updateTask.isPending}
                          >
                            Dry-run
                          </button>
                        </div>
                      </div>
                    </header>
                    {task.payload ? (
                      <pre className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-white/60 p-3 text-xs text-[color:var(--color-foreground)]">
                        {JSON.stringify(task.payload, null, 2)}
                      </pre>
                    ) : null}
                    {task.error ? (
                      <p className="mt-2 rounded bg-red-50/90 p-2 text-xs text-red-600">
                        {task.error}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[color:var(--color-muted)]">
                No open tasks for this persona.
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Agent logs"
            description="Last 100 actions recorded against this persona across deployments and ingest pipelines."
          >
            {auditQuery.isLoading ? (
              <div className="text-sm text-[color:var(--color-muted)]">Loading audit history…</div>
            ) : auditQuery.data?.events?.length ? (
              <ul className="space-y-2 text-sm">
                {auditQuery.data.events.map((event: any) => (
                  <li
                    key={event.id}
                    className="rounded-lg border border-[color:var(--color-border)]/50 bg-white/70 px-4 py-3"
                  >
                    <div className="flex items-center justify-between text-xs text-[color:var(--color-muted)]">
                      <span>
                        {event.actor ?? "system"} → {event.action}
                      </span>
                      <time>{new Date(event.created_at).toLocaleString()}</time>
                    </div>
                    {event.meta ? (
                      <pre className="mt-2 overflow-x-auto text-xs text-[color:var(--color-foreground)]">
                        {JSON.stringify(event.meta, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-[color:var(--color-muted)]">
                No audit log entries yet.
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
