export const dynamic = "force-dynamic";

import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { PayersClient } from "./PayersClient";

export const metadata = createPanelPageMetadata("/client-portal/payers");

export default function PayersPage() {
  return <PayersClient />;
}
