export const dynamic = 'force-dynamic';

import { createPanelPageMetadata } from "@/components/layout/nav-items";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/api/queryClient";
import {
  fetchInsuranceQuotes,
  insuranceQueryKeys,
  type InsuranceQueryParams,
} from "@/lib/queries/insurance";
import { InsuranceClient } from "./InsuranceClient";

export const metadata = createPanelPageMetadata("/insurance");

const DEFAULT_PARAMS: InsuranceQueryParams = { limit: 100 };

export default function InsurancePage() {
  return <InsuranceClient initialParams={DEFAULT_PARAMS} />;
}
