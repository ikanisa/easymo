import { TripsClient } from "./TripsClient";
import { createPanelPageMetadata } from "@/components/layout/nav-items";

export const dynamic = 'force-dynamic';
export const metadata = createPanelPageMetadata("/trips");

export default function TripsPage() {
  return <TripsClient />;
}
