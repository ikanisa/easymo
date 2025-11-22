import { RequestsDatabase } from "@/components/insurance/RequestsDatabase";
import { PageHeader } from "@/components/layout/PageHeader";

export default function InsuranceRequestsPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Requests database"
        description="Audit all in-flight insurance requests, escalations, and outstanding balances."
      />
      <RequestsDatabase />
    </div>
  );
}
export const dynamic = "force-dynamic";
