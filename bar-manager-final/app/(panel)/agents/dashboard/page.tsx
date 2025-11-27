import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { AgentsDashboardClient } from "./AgentsDashboardClient";

export const metadata = createPanelPageMetadata("/agents/dashboard");

export default function AgentsDashboardPage() {
  return <AgentsDashboardClient />;
}

