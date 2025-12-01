export const dynamic = "force-dynamic";

import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { NewSmsVendorClient } from "./NewSmsVendorClient";

export const metadata = createPanelPageMetadata("/sms-vendors/new");

export default function NewSmsVendorPage() {
  return <NewSmsVendorClient />;
}
