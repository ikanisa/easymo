"use client";
import useSWR from "swr";
import Link from "next/link";
import { getAdminApiPath, getAdminRoutePath } from "@/lib/routes";

export default function AgentsIndex() {
  const { data, error, isLoading } = useSWR(
    getAdminApiPath("agents"),
    (url) => fetch(url).then((r) => r.json()),
  );
  if (error) return <div className="p-4 text-red-600">Failed to load agents</div>;
  if (isLoading) return <div className="p-4">Loading agents…</div>;
  const agents = data?.agents ?? [];
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Agents</h1>
        <Link
          href={getAdminRoutePath("adminAgentNew")}
          className="px-3 py-2 bg-black text-white rounded"
        >
          New Agent
        </Link>
      </div>
      <div className="grid gap-3">
        {agents.map((a: any) => (
          <Link
            key={a.id}
            href={getAdminRoutePath("adminAgentDetail", { agentId: String(a.id) })}
            className="border rounded p-3 hover:bg-gray-50"
          >
            <div className="font-medium">{a.name}</div>
            <div className="text-sm text-gray-600">{a.summary || "No summary"}</div>
            <div className="text-xs text-gray-500">{a.status} • {a.default_language}</div>
          </Link>
        ))}
        {agents.length === 0 && <div className="text-gray-600">No agents yet.</div>}
      </div>
    </div>
  );
}

