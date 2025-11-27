import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { AgentDetailsClient } from "./AgentDetailsClient";

export const metadata = createPanelPageMetadata("/agents/[id]");

export default function AgentDetailsPage() {
  return <AgentDetailsClient />;
}
