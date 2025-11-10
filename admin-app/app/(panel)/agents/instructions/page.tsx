import { PageHeader } from "@/components/layout/PageHeader";
import { InstructionsPlaybooks } from "@/components/agents/InstructionsPlaybooks";

export default function AgentInstructionsPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Instructions & playbooks"
        description="Give every pod the same operating manual with rich, interactive playbooks."
      />
      <InstructionsPlaybooks />
    </div>
  );
}
