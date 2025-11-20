"use client";
import Link from "next/link";
import { useAgentsList, useCreateAgent, type AgentPersona } from "@/lib/queries/agents";
import { useState } from "react";

export function AgentsClient() {
  const { data, isLoading, error } = useAgentsList();
  const create = useCreateAgent();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">AI Agents</h1>
      <div className="rounded border bg-amber-50 text-amber-900 p-3 text-sm">
        Tip: Configure LLM provider routing per agent in
        {" "}
        <a className="underline" href="/agents/provider-routing">Provider routing</a>
        {" "}
        (or {" "}
        <a className="underline" href="/agent-admin/agents">Admin view</a>
        ).
      </div>
      <form
        className="flex gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate({ name, key: key || undefined });
          setName("");
          setKey("");
        }}
      >
        <div className="flex flex-col">
          <label className="text-sm">Name</label>
          <input className="border rounded px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col">
          <label className="text-sm">Key (optional)</label>
          <input className="border rounded px-2 py-1" value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        <button type="submit" className="bg-black text-white px-3 py-1 rounded">Create</button>
      </form>

      {isLoading && <div>Loading…</div>}
      {Boolean(error) && <div className="text-red-600">Failed to load agents</div>}
      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-2">Name</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Docs</th>
            <th className="text-left p-2">Chunks</th>
            <th className="text-left p-2">Updated</th>
          </tr>
        </thead>
        <tbody>
          {(data?.agents ?? []).map((agent: AgentPersona) => {
            const stats = agent.vector_stats ?? { totalDocs: 0, readyDocs: 0, jsonChunks: 0, vecChunks: 0 };
            return (
              <tr key={agent.id} className="border-t">
                <td className="p-2"><Link className="underline" href={`/agents/${agent.id}`}>{agent.name}</Link></td>
                <td className="p-2">{agent.status}</td>
              <td className="p-2 text-xs">{stats.readyDocs}/{stats.totalDocs}</td>
              <td className="p-2 text-xs">json {stats.jsonChunks} · vec {stats.vecChunks}</td>
                <td className="p-2">{new Date(agent.updated_at).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
