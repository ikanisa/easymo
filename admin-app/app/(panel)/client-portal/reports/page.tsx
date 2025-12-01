export const dynamic = "force-dynamic";

import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { ReportsClient } from "./ReportsClient";

export const metadata = createPanelPageMetadata("/client-portal/reports");

export default function ReportsPage() {
  return <ReportsClient />;
}
