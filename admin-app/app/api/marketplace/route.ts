export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  vendorRankingSchema,
  marketplaceIntentSchema,
  marketplacePurchaseSchema,
} from "@/lib/schemas";
import {
  mockVendorRankings,
  mockMarketplaceIntents,
  mockMarketplacePurchases,
} from "@/lib/mock-data";
import { getMarketplaceServiceUrls, shouldUseMocks } from "@/lib/runtime-config";

const rankingResponseSchema = z.object({
  vendors: z.array(vendorRankingSchema),
});

const intentsResponseSchema = z.object({
  intents: z.array(marketplaceIntentSchema),
});

const purchasesResponseSchema = z.object({
  purchases: z.array(marketplacePurchaseSchema),
});

function fallback() {
  return NextResponse.json({
    vendors: mockVendorRankings,
    intents: mockMarketplaceIntents,
    purchases: mockMarketplacePurchases,
    integration: {
      status: "mock",
      message: "Marketplace services unreachable; using fixtures",
    },
  });
}

async function safeFetch(url: string | null, schema: z.ZodTypeAny) {
  if (!url) return null;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  const json = await response.json();
  return schema.parse(json);
}

export async function GET() {
  if (shouldUseMocks()) {
    return fallback();
  }

  const urls = getMarketplaceServiceUrls();
  if (!urls.ranking || !urls.buyer) {
    return fallback();
  }

  try {
    const [ranking, intents, purchases] = await Promise.all([
      safeFetch(
        `${urls.ranking.replace(/\/$/, "")}/ranking/vendors`,
        rankingResponseSchema,
      ),
      safeFetch(
        `${urls.buyer.replace(/\/$/, "")}/intents`,
        intentsResponseSchema,
      ),
      safeFetch(
        `${urls.buyer.replace(/\/$/, "")}/purchases`,
        purchasesResponseSchema,
      ),
    ]);

    return NextResponse.json({
      vendors: ranking?.vendors ?? mockVendorRankings,
      intents: intents?.intents ?? mockMarketplaceIntents,
      purchases: purchases?.purchases ?? mockMarketplacePurchases,
      integration: {
        status: "ok",
      },
    });
  } catch (error) {
    console.error("marketplace.summary.failed", error);
    return fallback();
  }
}

export const runtime = "edge";
