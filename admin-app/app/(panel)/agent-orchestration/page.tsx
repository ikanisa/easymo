import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { AgentOrchestrationClient } from "./AgentOrchestrationClient";

export const metadata = createPanelPageMetadata("/agent-orchestration");

export default function AgentOrchestrationPage() {
  return <AgentOrchestrationClient />;
}
