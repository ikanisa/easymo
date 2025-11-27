import { InstructionsPlaybooks } from "@/components/agents/InstructionsPlaybooks";
import { PageHeader } from "@/components/layout/PageHeader";

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
