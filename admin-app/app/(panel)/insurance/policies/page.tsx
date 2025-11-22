import { PoliciesDatabase } from "@/components/insurance/PoliciesDatabase";
import { PageHeader } from "@/components/layout/PageHeader";

export default function InsurancePoliciesPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Policies database"
        description="Search issued policies, breakdowns, and lifecycle states synced from Supabase."
      />
      <PoliciesDatabase />
    </div>
  );
}
export const dynamic = "force-dynamic";
