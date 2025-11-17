import { PageHeader } from "@/components/layout/PageHeader";
import { RequestsDatabase } from "@/components/insurance/RequestsDatabase";

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
