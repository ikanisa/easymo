import { AgentsClient } from "./AgentsClient";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const metadata = createPanelPageMetadata("/agents");

export default function AgentsPage() {
  return <AgentsClient />;
}
