import { PageHeader } from "@/components/layout/PageHeader";
import { AnalyticsDashboards } from "@/components/analytics/AnalyticsDashboards";

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
