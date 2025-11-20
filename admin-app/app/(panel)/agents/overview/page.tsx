import { PageHeader } from "@/components/layout/PageHeader";
import { AgentOverviewKpis } from "@/components/agents/AgentOverviewKpis";
import Link from "next/link";

export default function AgentOverviewPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Agent overview"
        description="Monitor throughput, SLA compliance, and backlog health for insurance agents."
      />
      <AgentOverviewKpis />
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-4 bg-white">
          <h3 className="font-medium mb-1">LLM Provider Routing</h3>
          <p className="text-sm text-gray-600 mb-3">Configure primary/fallback LLM providers and model settings per agent.</p>
          <div className="flex gap-2">
            <Link href="/agents/provider-routing" className="bg-blue-600 text-white px-3 py-1 rounded">Open panel</Link>
            <Link href="/agent-admin/agents" className="border px-3 py-1 rounded">Admin view</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
