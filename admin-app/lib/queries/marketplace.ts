import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { getAdminApiPath } from "@/lib/routes";
import {
  marketplaceIntentSchema,
  marketplacePurchaseSchema,
  vendorRankingSchema,
} from "@/lib/schemas";

const MARKETPLACE_KEY = ["marketplace", "summary"] as const;

const marketplaceResponseSchema = z.object({
  vendors: z.array(vendorRankingSchema),
  intents: z.array(marketplaceIntentSchema),
  purchases: z.array(marketplacePurchaseSchema),
  integration: z
    .object({ status: z.string(), message: z.string().optional() })
    .optional(),
});

export type MarketplaceSummary = z.infer<typeof marketplaceResponseSchema>;

export async function fetchMarketplaceSummary(): Promise<MarketplaceSummary> {
  const response = await fetch(getAdminApiPath("marketplace"), { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load marketplace summary");
  }
  return marketplaceResponseSchema.parse(await response.json());
}

export function useMarketplaceSummaryQuery() {
  return useQuery({
    queryKey: MARKETPLACE_KEY,
    queryFn: fetchMarketplaceSummary,
    staleTime: 60_000,
  });
}

export const marketplaceQueryKeys = {
  summary: () => MARKETPLACE_KEY,
};
