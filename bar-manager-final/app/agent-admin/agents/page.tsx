import { Suspense } from "react";

import AgentRow from "@/components/agent-admin/AgentRow";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

async function fetchAgents() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/agent-admin/agents`, { cache: "no-store" });
  if (!res.ok) throw new Error("failed_to_load_agents");
  return (await res.json()) as { agents: Array<{ agent_type: string; primary_provider: string | null; fallback_provider: string | null; provider_config: any; is_active: boolean; updated_at?: string; updated_by?: string | null }>; };
}

export default async function AgentsProviderConfigPage() {
  const { agents } = await fetchAgents();
  return (
    <ProtectedRoute requireAdmin>
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Agent Provider Configuration</h1>
        <p className="text-sm text-gray-600 mb-6">Edit primary/fallback LLM providers and model settings for each agent.</p>
        <div className="mb-3"><span className="text-xs border rounded px-2 py-0.5 bg-amber-100 text-amber-700">Admin only</span></div>
        <Suspense>
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2 border">Agent</th>
                <th className="text-left p-2 border">Primary</th>
                <th className="text-left p-2 border">Fallback</th>
                <th className="text-left p-2 border">OpenAI Model</th>
                <th className="text-left p-2 border">Gemini Model</th>
                <th className="text-left p-2 border">Active</th>
                <th className="text-left p-2 border">Updated</th>
                <th className="text-left p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <AgentRow key={a.agent_type} agent={a} />
              ))}
            </tbody>
          </table>
        </Suspense>
      </div>
    </ProtectedRoute>
  );
}

// Client row in components/agent-admin/AgentRow.tsx
