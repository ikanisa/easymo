import { AgentPerformanceDashboard } from "@/components/analytics/AgentPerformanceDashboard";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AIAgentAnalyticsPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="AI Agent Analytics"
        description="Real-time performance metrics, tool usage, and engagement analytics for all AI agents."
      />
      <AgentPerformanceDashboard />
    </div>
  );
}
