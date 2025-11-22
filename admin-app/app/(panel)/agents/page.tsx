import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { AgentsClient } from "./AgentsClient";

export const metadata = createPanelPageMetadata("/agents");

export default function AgentsPage() {
  return <AgentsClient />;
}
