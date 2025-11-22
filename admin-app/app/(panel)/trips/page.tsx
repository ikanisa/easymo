import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { TripsClient } from "./TripsClient";

export const dynamic = 'force-dynamic';
export const metadata = createPanelPageMetadata("/trips");

export default function TripsPage() {
  return <TripsClient />;
}
