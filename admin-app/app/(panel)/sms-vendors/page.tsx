export const dynamic = "force-dynamic";

import { createPanelPageMetadata } from "@/components/layout/nav-items";

import { SmsVendorsClient } from "./SmsVendorsClient";

export const metadata = createPanelPageMetadata("/sms-vendors");

export default function SmsVendorsPage() {
  return <SmsVendorsClient />;
}
