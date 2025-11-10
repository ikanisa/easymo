import { SectionCard } from "@/components/ui/SectionCard";
import { IntegrationsStatus } from "@/components/settings/IntegrationsStatus";

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
