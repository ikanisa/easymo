"use client";
import { useParams } from "next/navigation";
import { useAgentDetailAggregate, useCreateVersion, useDeployVersion, useUploadAgentDocument, useDeleteAgentDocument, useAgentTasks, useAgentRuns, useAgentRunDetails, useAgentAudit, useAddAgentDocUrl, useEmbedAllAgentDocs, useDriveSyncAgentDocs, useWebSearchImportAgentDocs, useEmbedAgentDocument, useSearchAgentKnowledge } from "@/lib/queries/agents";
import { getAdminApiRoutePath } from "@/lib/routes";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { Tooltip } from "@/components/ui/Tooltip";

export default function AgentDetailsPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const detailQ = useAgentDetailAggregate(id);
  const createVersion = useCreateVersion(id);
  const deploy = useDeployVersion(id);
  const [instructions, setInstructions] = useState("");
  const upload = useUploadAgentDocument(id);
  const delDoc = useDeleteAgentDocument(id);
  const tasksQ = useAgentTasks(id);
  const runsQ = useAgentRuns(id);
  const auditQ = useAgentAudit(id);
  const [runDetailId, setRunDetailId] = useState<string | null>(null);
  const runDetail = useAgentRunDetails(id, runDetailId || "");
  const [taskType, setTaskType] = useState("");
  const [taskSchedule, setTaskSchedule] = useState("");

  // Aggregate detail (agent, versions, documents, vector stats)

  // Document ingestion helpers
  const [addingUrl, setAddingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [embedDocId, setEmbedDocId] = useState<string | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const embedAll = useEmbedAllAgentDocs(id);
  const addUrl = useAddAgentDocUrl(id);
  const driveSync = useDriveSyncAgentDocs(id);
  const webImport = useWebSearchImportAgentDocs(id);
  const embedDoc = useEmbedAgentDocument(id);
  const { pushToast } = useToast();

  // Knowledge search state
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [topK, setTopK] = useState<number>(8);
  const searchKnowledge = useSearchAgentKnowledge(id);

  // React Query manages fetching/refresh

  // Polling: if any document is pending/processing, refetch detail periodically until ready
  useEffect(() => {
    if (!detailQ.data?.documents?.length) return;
    const hasInFlight = detailQ.data.documents.some((d: any) => d.embedding_status && d.embedding_status !== 'ready');
    if (!hasInFlight) return;
    const started = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - started;
      if (elapsed > 30_000) { clearInterval(timer); return; }
      detailQ.refetch();
    }, 2000);
    return () => clearInterval(timer);
  }, [detailQ, detailQ.data?.documents]);

  if (!id) return <div className="p-6">Invalid agent id</div>;
  if (detailQ.isLoading) return <div className="p-6">Loading…</div>;
  if (detailQ.isError) return <div className="p-6 text-red-600">Failed to load agent</div>;

  const agent = detailQ.data?.agent;

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
            {(detailQ.data?.versions ?? []).map((v: any) => (
              <tr key={v.id} className="border-t">
                <td className="p-2">{v.version}</td>
                <td className="p-2">{v.status}</td>
                <td className="p-2">{new Date(v.created_at).toLocaleString()}</td>
                <td className="p-2">
                  <button
                    className="px-2 py-1 border rounded"
                    onClick={() => deploy.mutate({ version: v.version })}
                  >Deploy</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Documents</h2>
        {detailQ.data?.vectorStats && (
          <div className="text-xs text-gray-600">Embeddings: JSON chunks {detailQ.data.vectorStats.jsonChunks}, Vector chunks {detailQ.data.vectorStats.vecChunks} across {detailQ.data.vectorStats.readyDocs}/{detailQ.data.vectorStats.totalDocs} ready docs</div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <span>Upload</span>
            <input type="file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { await upload.mutateAsync(f); pushToast({ title: 'Upload complete', description: f.name }); } catch { pushToast({ title: 'Upload failed', kind: 'error' }); } } }} />
          </label>
          {upload.isPending && <span>Uploading…</span>}
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            disabled={embedAll.isPending}
            onClick={() => embedAll.mutate({ include_ready: false }, { onSuccess: (r: any) => pushToast({ title: 'Re-embed triggered', description: `${r?.ok ?? 0} ok, ${r?.fail ?? 0} fail` }), onError: () => pushToast({ title: 'Embed all failed', kind: 'error' }) })}
          >{embedAll.isPending ? 'Embedding…' : 'Re-embed All'}</button>
        </div>

        <form
          className="flex items-center gap-2 mt-2"
          onSubmit={async (e) => {
            e.preventDefault(); setAddingUrl(true); setUrlError(null);
            const fd = new FormData(e.currentTarget as HTMLFormElement);
            try {
              const res: any = await addUrl.mutateAsync({ title: String(fd.get('url_title') || ''), url: String(fd.get('url') || '') });
              if (res?.duplicate) {
                pushToast({ title: 'URL already exists', description: 'Document was previously added' });
              } else {
                pushToast({ title: 'URL added' });
              }
              (e.currentTarget as any).reset();
            } catch (err) {
              setUrlError(err instanceof Error ? err.message : String(err));
              pushToast({ title: 'Add URL failed', description: String(err instanceof Error ? err.message : err), kind: 'error' });
            } finally { setAddingUrl(false); }
          }}
        >
          <input type="text" name="url_title" placeholder="Title (optional)" className="border rounded px-2 py-1" />
          <input type="url" name="url" placeholder="https://example.com/doc.txt" required className="border rounded px-2 py-1 flex-1" />
          <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={addingUrl}>{addingUrl ? 'Adding…' : 'Add URL'}</button>
          {urlError && <span className="text-xs text-red-600">{urlError}</span>}
        </form>

        <form
          className="flex items-center gap-2 mt-2"
          onSubmit={async (e) => {
            e.preventDefault(); setDriveBusy(true); setIngestError(null);
            const fd = new FormData(e.currentTarget as HTMLFormElement);
            try {
              const res: any = await driveSync.mutateAsync({ folder: String(fd.get('drive_folder') || '') });
              pushToast({ title: 'Drive sync started', description: `Imported ${res?.imported ?? 0}${typeof res?.duplicates === 'number' ? `, duplicates ${res.duplicates}` : ''}` });
              (e.currentTarget as any).reset();
            } catch (err) { setIngestError(err instanceof Error ? err.message : String(err)); }
            finally { setDriveBusy(false); }
          }}
        >
          <input type="url" name="drive_folder" placeholder="Google Drive folder URL or ID" required className="border rounded px-2 py-1 flex-1" />
          <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={driveBusy}>{driveBusy ? 'Syncing…' : 'Sync Drive'}</button>
        </form>

        <form
          className="flex items-center gap-2 mt-2"
          onSubmit={async (e) => {
            e.preventDefault(); setSearchBusy(true); setIngestError(null);
            const fd = new FormData(e.currentTarget as HTMLFormElement);
            try {
              const res: any = await webImport.mutateAsync({ query: String(fd.get('web_query') || ''), top_n: Number(fd.get('web_top_n') || 5) });
              const parts: string[] = [];
              parts.push(`imported ${res?.imported ?? 0}`);
              if (typeof res?.duplicates === 'number') parts.push(`duplicates ${res.duplicates}`);
              if (typeof res?.skipped === 'number') parts.push(`skipped ${res.skipped}`);
              pushToast({ title: 'Imported from web search', description: parts.join(', ') });
              (e.currentTarget as any).reset();
            } catch (err) { setIngestError(err instanceof Error ? err.message : String(err)); }
            finally { setSearchBusy(false); }
          }}
        >
          <input type="text" name="web_query" placeholder="Web search query" required className="border rounded px-2 py-1 flex-1" />
          <input type="number" name="web_top_n" min={1} max={50} defaultValue={5} className="w-24 border rounded px-2 py-1" />
          <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={searchBusy}>{searchBusy ? 'Searching…' : 'Add from Web'}</button>
          {ingestError && <span className="text-xs text-red-600">{ingestError}</span>}
        </form>
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Created</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(detailQ.data?.documents ?? []).map((d: any) => {
              const isTemp = d?.metadata?.__temp;
              return (
              <tr key={d.id} className={`border-t ${isTemp ? 'opacity-60 italic' : ''}`}>
                <td className="p-2">
                  {d.title}
                  {isTemp && (
                    <Tooltip label="Temporary row — awaiting server insert">
                      <span className="ml-2 inline-block rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-900">New</span>
                    </Tooltip>
                  )}
                  {d.embedding_status && d.embedding_status !== 'ready' && !isTemp && (
                    <Tooltip label="Embedding in progress or pending">
                      <span className="ml-2 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-900">{d.embedding_status}</span>
                    </Tooltip>
                  )}
                  {d.embedding_status === 'ready' && (
                    <Tooltip label="Embeddings complete and searchable">
                      <span className="ml-2 inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-900">Ready</span>
                    </Tooltip>
                  )}
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
                <td className="p-2">{new Date(d.created_at).toLocaleString()}</td>
                <td className="p-2">
                  <button className="px-2 py-1 border rounded" onClick={() => delDoc.mutate(d.id, { onSuccess: () => pushToast({ title: 'Deleted document' }), onError: () => pushToast({ title: 'Delete failed', kind: 'error' }) })}>Delete</button>
                  {d.embedding_status !== 'ready' && (
                    <button
                      className="ml-2 px-2 py-1 border rounded disabled:opacity-50"
                      disabled={embedDoc.isPending && embedDocId === d.id}
                      onClick={async () => { setEmbedDocId(d.id); try { await embedDoc.mutateAsync(d.id); pushToast({ title: 'Embedding started', description: d.title }); } catch { pushToast({ title: 'Embed failed', kind: 'error' }); } finally { setEmbedDocId(null); } }}
                    >{(embedDoc.isPending && embedDocId === d.id) ? 'Embedding…' : (d.embedding_status === 'failed' ? 'Retry' : 'Embed')}</button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Search Knowledge</h2>
        <form
          className="flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget as HTMLFormElement);
            const query = String(fd.get('query') || '').trim();
            if (!query) return;
            const json = await searchKnowledge.mutateAsync({ query, top_k: topK }).catch(() => ({} as any));
            setSearchResults(Array.isArray(json?.results) ? json.results : []);
          }}
        >
          <input type="text" name="query" placeholder="Ask a question or search text" className="border rounded px-3 py-2 flex-1" />
          <input type="number" min={1} max={50} value={topK} onChange={(e) => setTopK(Number(e.currentTarget.value || 8))} className="w-20 border rounded px-2 py-2" title="Top K" />
          <button className="px-3 py-2 border rounded">Search</button>
        </form>
        <div className="grid gap-2">
          {searchResults.map((r: any, idx: number) => (
            <div key={idx} className="border rounded p-3">
              <div className="text-xs text-gray-500">score: {r.score?.toFixed?.(3) ?? r.score}</div>
              <pre className="whitespace-pre-wrap text-sm">{r.content}</pre>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>source: {r.document?.title || r.document?.storage_path || r.document?.id}</span>
                {r.document?.id && (
                  <a
                    className="underline text-blue-600"
                    href={getAdminApiRoutePath("agentDocumentPreview", { agentId: id, documentId: String(r.document.id) })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Preview
                  </a>
                )}
              </div>
            </div>
          ))}
          {(!searchResults || searchResults.length === 0) && <div className="text-gray-600">No results.</div>}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Tasks</h2>
        <form
          className="flex gap-2 items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const payload: any = { type: taskType };
            if (taskSchedule) payload.scheduled_at = taskSchedule;
            await fetch(
              getAdminApiRoutePath("agentTasks", { agentId: id }),
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
              },
            );
            setTaskType(""); setTaskSchedule("");
          }}
        >
          <div className="flex flex-col">
            <label className="text-sm">Type</label>
            <input className="border rounded px-2 py-1" value={taskType} onChange={(e) => setTaskType(e.target.value)} placeholder="index_documents | warmup | sync" />
          </div>
          <div className="flex flex-col">
            <label className="text-sm">Scheduled at (ISO)</label>
            <input className="border rounded px-2 py-1" value={taskSchedule} onChange={(e) => setTaskSchedule(e.target.value)} placeholder="2025-01-01T12:00:00Z" />
          </div>
          <button type="submit" className="bg-black text-white px-3 py-1 rounded">Queue</button>
        </form>
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
                <td className="p-2"><button className="px-2 py-1 border rounded" onClick={() => setRunDetailId(r.id)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {runDetailId && runDetail?.data?.run && (
          <div className="border rounded p-3 bg-gray-50">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Run Details</h3>
              <button className="px-2 py-0.5 border rounded" onClick={() => setRunDetailId(null)}>Close</button>
            </div>
            <pre className="text-xs overflow-auto max-h-64">{JSON.stringify(runDetail.data.run, null, 2)}</pre>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Audit Log</h2>
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">When</th>
              <th className="text-left p-2">Actor</th>
              <th className="text-left p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {(auditQ.data?.events ?? []).map((ev: any) => (
              <tr key={ev.id} className="border-t">
                <td className="p-2">{new Date(ev.created_at).toLocaleString()}</td>
                <td className="p-2">{ev.actor ?? "system"}</td>
                <td className="p-2">{ev.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export const runtime = "edge";
