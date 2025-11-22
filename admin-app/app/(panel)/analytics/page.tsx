import { AnalyticsDashboards } from "@/components/analytics/AnalyticsDashboards";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AnalyticsPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Analytics"
        description="Track conversion, SLA, and revenue trends from a single analytics surface."
      />
      <AnalyticsDashboards />
    </div>
  );
}
