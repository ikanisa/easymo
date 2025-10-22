"use client";
import { useParams } from "next/navigation";
import { getAdminApiRoutePath } from "@/lib/routes";
import {
  useAgentDetails,
  useCreateVersion,
  useDeployVersion,
  useUploadAgentDocument,
  useDeleteAgentDocument,
  useAgentTasks,
  useAgentRuns,
} from "@/lib/queries/agents";
import { getAdminApiPath } from "@/lib/routes";
import { AgentKnowledgeStatusBanner } from "@/components/agents/AgentKnowledgeStatusBanner";
import { useToast } from "@/components/ui/ToastProvider";
import { useEffect, useRef, useState } from "react";

export default function AgentDetailsPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const { data, isLoading, error, dataUpdatedAt, isRefetching } = useAgentDetails(id);
  const createVersion = useCreateVersion(id);
  const deploy = useDeployVersion(id);
  const [instructions, setInstructions] = useState("");
  const upload = useUploadAgentDocument(id);
  const delDoc = useDeleteAgentDocument(id);
  const tasksQ = useAgentTasks(id);
  const runsQ = useAgentRuns(id);
  const { pushToast } = useToast();
  const lastPendingEmbeds = useRef(false);

  const agent = data?.agent;
  const versions = data?.versions ?? [];
  const documents = data?.documents ?? [];
  const knowledgeStats = data?.knowledgeStats;
  const deployments = data?.deployments ?? [];
  const pendingEmbeds = documents.some(
    (doc: any) => (doc.embedding_status ?? "pending").toLowerCase() !== "ready",
  );

  useEffect(() => {
    if (createVersion.isSuccess) {
      pushToast("Agent version created", "success");
    }
  }, [createVersion.isSuccess, pushToast]);

  useEffect(() => {
    if (createVersion.isError) {
      const message = createVersion.error instanceof Error
        ? createVersion.error.message
        : "Failed to create version";
      pushToast(message, "error");
    }
  }, [createVersion.error, createVersion.isError, pushToast]);

  useEffect(() => {
    if (deploy.isSuccess) {
      const payload = (deploy.data ?? {}) as {
        environment?: string;
        version?: number;
      };
      const env = payload.environment ?? "production";
      const versionLabel = typeof payload.version === "number" ? `v${payload.version}` : "version";
      pushToast(`Deployment triggered for ${versionLabel} in ${env}`, "success");
    }
  }, [deploy.data, deploy.isSuccess, pushToast]);

  useEffect(() => {
    if (deploy.isError) {
      const message = deploy.error instanceof Error ? deploy.error.message : "Failed to deploy version";
      pushToast(message, "error");
    }
  }, [deploy.error, deploy.isError, pushToast]);

  useEffect(() => {
    if (upload.isSuccess) {
      pushToast("Document uploaded successfully", "success");
    }
  }, [pushToast, upload.isSuccess]);

  useEffect(() => {
    if (upload.isError) {
      const message = upload.error instanceof Error ? upload.error.message : "Failed to upload document";
      pushToast(message, "error");
    }
  }, [pushToast, upload.error, upload.isError]);

  useEffect(() => {
    if (delDoc.isSuccess) {
      pushToast("Document deleted", "success");
    }
  }, [delDoc.isSuccess, pushToast]);

  useEffect(() => {
    if (delDoc.isError) {
      const message = delDoc.error instanceof Error ? delDoc.error.message : "Failed to delete document";
      pushToast(message, "error");
    }
  }, [delDoc.error, delDoc.isError, pushToast]);

  useEffect(() => {
    if (documents.length === 0) {
      lastPendingEmbeds.current = false;
      return;
    }

    if (pendingEmbeds) {
      if (!lastPendingEmbeds.current) {
        pushToast("Embedding jobs are running", "info");
      }
      lastPendingEmbeds.current = true;
      return;
    }

    if (lastPendingEmbeds.current && !pendingEmbeds) {
      lastPendingEmbeds.current = false;
      pushToast("All knowledge documents are embedded and ready", "success");
    }
  }, [documents.length, pendingEmbeds, pushToast]);

  if (!id) return <div className="p-6">Invalid agent id</div>;
  if (isLoading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">Failed to load agent</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{agent?.name}</h1>
      <div className="text-sm text-gray-600">Status: {agent?.status}</div>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Versions</h2>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createVersion.mutate({ instructions });
            setInstructions("");
          }}
        >
          <textarea className="border rounded p-2 h-28" placeholder="Instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          <button type="submit" className="bg-black text-white px-3 py-1 rounded self-start">Create Version</button>
        </form>
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">Version</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Created</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v: any) => (
              <tr key={v.id} className="border-t">
                <td className="p-2">{v.version}</td>
                <td className="p-2">{v.status}</td>
                <td className="p-2">{new Date(v.created_at).toLocaleString()}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="px-2 py-1 border rounded"
                      disabled={deploy.isPending}
                      onClick={() => deploy.mutate({ version: v.version, environment: "staging" })}
                    >Deploy to Staging</button>
                    <button
                      className="px-2 py-1 border rounded bg-gray-900 text-white"
                      disabled={deploy.isPending}
                      onClick={() => deploy.mutate({ version: v.version, environment: "production" })}
                    >Deploy to Production</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deploy.isPending && <div className="text-sm text-gray-600">Deploying version…</div>}
        {deploy.isSuccess && (
          <div className="text-sm text-green-600">Deployment triggered successfully.</div>
        )}
        {deploy.isError && (
          <div className="text-sm text-red-600">Failed to deploy version. Please try again.</div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Documents</h2>
        <div className="flex items-center gap-2">
          <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
          {upload.isPending && <span>Uploading…</span>}
        </div>
        <AgentKnowledgeStatusBanner
          stats={knowledgeStats}
          totalDocuments={documents.length}
          pendingEmbeds={pendingEmbeds}
          isPolling={Boolean(isRefetching && pendingEmbeds)}
          dataUpdatedAt={dataUpdatedAt}
        />
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Embedding Status</th>
              <th className="text-left p-2">Created</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d: any) => (
              <tr key={d.id} className="border-t">
                <td className="p-2">
                  {d.title}
                  <button
                    className="ml-2 px-2 py-0.5 border rounded text-xs"
                    onClick={async () => {
                      const res = await fetch(
                        getAdminApiRoutePath("agentDocumentSigned", {
                          agentId: String(agent.id),
                          documentId: String(d.id),
                        }),
                      );
                      if (res.ok) {
                        const json = await res.json();
                        if (json.url) window.open(json.url, "_blank");
                      }
                    }}
                  >Open</button>
                </td>
                <td className="p-2 capitalize">{(d.embedding_status ?? "pending").replace(/_/g, " ")}</td>
                <td className="p-2">{new Date(d.created_at).toLocaleString()}</td>
                <td className="p-2">
                  <button className="px-2 py-1 border rounded" onClick={() => delDoc.mutate(d.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {knowledgeStats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="border rounded p-3">
              <div className="text-gray-500">Documents</div>
              <div className="text-lg font-semibold">{knowledgeStats.total}</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-gray-500">Ready</div>
              <div className="text-lg font-semibold text-green-600">{knowledgeStats.ready}</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-gray-500">Processing</div>
              <div className="text-lg font-semibold text-amber-600">{knowledgeStats.processing + knowledgeStats.pending}</div>
              <div className="text-xs text-gray-500">Pending: {knowledgeStats.pending} · Processing: {knowledgeStats.processing}</div>
            </div>
            <div className="border rounded p-3 sm:col-span-2">
              <div className="text-gray-500">Failed</div>
              <div className="text-lg font-semibold text-red-600">{knowledgeStats.failed}</div>
            </div>
            {knowledgeStats.other > 0 && (
              <div className="border rounded p-3">
                <div className="text-gray-500">Other</div>
                <div className="text-lg font-semibold">{knowledgeStats.other}</div>
              </div>
            )}
          </div>
        )}
        {pendingEmbeds && (
          <div className="text-sm text-gray-600">Embedding jobs are still running. This page will refresh automatically.</div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Deployments</h2>
        {deployments.length === 0 ? (
          <div className="text-sm text-gray-600">No deployments yet.</div>
        ) : (
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2">Environment</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Version ID</th>
                <th className="text-left p-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((deployment: any) => (
                <tr key={deployment.id} className="border-t">
                  <td className="p-2 capitalize">{deployment.environment}</td>
                  <td className="p-2 capitalize">{deployment.status}</td>
                  <td className="p-2 text-xs font-mono break-all">{deployment.version_id}</td>
                  <td className="p-2">{new Date(deployment.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Tasks</h2>
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Scheduled</th>
              <th className="text-left p-2">Started</th>
              <th className="text-left p-2">Completed</th>
            </tr>
          </thead>
          <tbody>
            {(tasksQ.data?.tasks ?? []).map((t: any) => (
              <tr key={t.id} className="border-t">
                <td className="p-2">{t.type}</td>
                <td className="p-2">{t.status}</td>
                <td className="p-2">{t.scheduled_at ?? "-"}</td>
                <td className="p-2">{t.started_at ?? "-"}</td>
                <td className="p-2">{t.completed_at ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Runs</h2>
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Started</th>
              <th className="text-left p-2">Completed</th>
            </tr>
          </thead>
          <tbody>
            {(runsQ.data?.runs ?? []).map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.status}</td>
                <td className="p-2">{r.started_at}</td>
                <td className="p-2">{r.completed_at ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
