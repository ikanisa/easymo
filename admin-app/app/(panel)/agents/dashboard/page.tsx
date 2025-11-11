import { AgentsDashboardClient } from "./AgentsDashboardClient";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/agents/dashboard");

export default function AgentsDashboardPage() {
  return <AgentsDashboardClient />;
}

