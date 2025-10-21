"use client";
import { useParams } from "next/navigation";
import { useAgentDetails, useCreateVersion, useDeployVersion, useUploadAgentDocument, useDeleteAgentDocument } from "@/lib/queries/agents";
import { useState } from "react";

export default function AgentDetailsPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const { data, isLoading, error } = useAgentDetails(id);
  const createVersion = useCreateVersion(id);
  const deploy = useDeployVersion(id);
  const [instructions, setInstructions] = useState("");
  const upload = useUploadAgentDocument(id);
  const delDoc = useDeleteAgentDocument(id);

  if (!id) return <div className="p-6">Invalid agent id</div>;
  if (isLoading) return <div className="p-6">Loading…</div>;
  if (error) return <div className="p-6 text-red-600">Failed to load agent</div>;

  const agent = data?.agent;
  const versions = data?.versions ?? [];
  const documents = data?.documents ?? [];

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
        <div className="flex items-center gap-2">
          <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); }} />
          {upload.isPending && <span>Uploading…</span>}
        </div>
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Created</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d: any) => (
              <tr key={d.id} className="border-t">
                <td className="p-2">{d.title}</td>
                <td className="p-2">{new Date(d.created_at).toLocaleString()}</td>
                <td className="p-2">
                  <button className="px-2 py-1 border rounded" onClick={() => delDoc.mutate(d.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
