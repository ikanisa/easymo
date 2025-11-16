export const dynamic = 'force-dynamic';

import { createPanelPageMetadata } from "@/components/layout/nav-items";
import type { InsuranceQueryParams } from "@/lib/queries/insurance";
import { InsuranceClient } from "./InsuranceClient";

export const metadata = createPanelPageMetadata("/insurance");

const DEFAULT_PARAMS: InsuranceQueryParams = { limit: 100 };

export default function InsurancePage() {
  return <InsuranceClient initialParams={DEFAULT_PARAMS} />;
}
