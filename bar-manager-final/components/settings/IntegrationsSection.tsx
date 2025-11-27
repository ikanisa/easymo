import { IntegrationsStatus } from "@/components/settings/IntegrationsStatus";
import { SectionCard } from "@/components/ui/SectionCard";

export function IntegrationsSection() {
  return (
    <SectionCard
      title="Integrations status"
      description="Media send and dispatcher probes refresh every 60 seconds."
    >
      <IntegrationsStatus />
    </SectionCard>
  );
}
