import { PageHeader } from "@/components/layout/PageHeader";
import { ToolsIntegrationsPanel } from "@/components/settings/ToolsIntegrationsPanel";

export default function ToolsPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Tools & integrations"
        description="Manage connected systems, monitor health, and refresh tokens as needed."
      />
      <ToolsIntegrationsPanel />
    </div>
  );
}
