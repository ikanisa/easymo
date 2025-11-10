export const dynamic = 'force-dynamic';

import { type InsuranceQueryParams } from "@/lib/queries/insurance";
import { InsuranceClient } from "./InsuranceClient";

const DEFAULT_PARAMS: InsuranceQueryParams = { limit: 50 };

export default function InsurancePage() {
  return <InsuranceClient initialParams={DEFAULT_PARAMS} />;
}

