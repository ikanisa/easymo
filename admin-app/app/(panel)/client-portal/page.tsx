export const dynamic = "force-dynamic";

import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { ClientPortalClient } from "./ClientPortalClient";

export const metadata = createPanelPageMetadata("/client-portal");

export default function ClientPortalPage() {
  return <ClientPortalClient />;
}
