import { AgentOrchestrationClient } from "./AgentOrchestrationClient";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/agent-orchestration");

export default function AgentOrchestrationPage() {
  return <AgentOrchestrationClient />;
}
