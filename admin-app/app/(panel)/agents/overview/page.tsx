import { PageHeader } from "@/components/layout/PageHeader";
import { AgentOverviewKpis } from "@/components/agents/AgentOverviewKpis";

export default function AgentOverviewPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Agent overview"
        description="Monitor throughput, SLA compliance, and backlog health for insurance agents."
      />
      <AgentOverviewKpis />
    </div>
  );
}
