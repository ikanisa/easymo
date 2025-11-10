import { PageHeader } from "@/components/layout/PageHeader";
import { AdminGovernancePanel } from "@/components/settings/AdminGovernancePanel";

export default function SettingsAdminPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Settings & admin"
        description="Review access controls, governance guardrails, and compliance tooling."
      />
      <AdminGovernancePanel />
    </div>
  );
}
