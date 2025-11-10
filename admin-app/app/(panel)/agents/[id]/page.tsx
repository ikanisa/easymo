import { AgentDetailsClient } from "./AgentDetailsClient";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/agents/[id]");

export default function AgentDetailsPage() {
  return <AgentDetailsClient />;
}
