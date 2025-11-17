export const dynamic = 'force-dynamic';
import { z } from "zod";
import {
  vendorRankingSchema,
  marketplaceIntentSchema,
  marketplacePurchaseSchema,
} from "@/lib/schemas";
import { getMarketplaceServiceUrls, shouldUseMocks } from "@/lib/runtime-config";
import { jsonError, jsonOk } from "@/lib/api/http";

const rankingResponseSchema = z.object({
  vendors: z.array(vendorRankingSchema),
});

const intentsResponseSchema = z.object({
  intents: z.array(marketplaceIntentSchema),
});

const purchasesResponseSchema = z.object({
  purchases: z.array(marketplacePurchaseSchema),
});

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
    return jsonError({ error: 'unavailable', message: 'Marketplace services not configured.' }, 503);
  }

  const urls = getMarketplaceServiceUrls();
  if (!urls.ranking || !urls.buyer) {
    return jsonError({ error: 'unavailable', message: 'Marketplace service URLs missing.' }, 503);
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

    if (!ranking || !intents || !purchases) {
      return jsonError({ error: 'partial_upstream', message: 'One or more marketplace endpoints failed.' }, 502);
    }
    return jsonOk({
      vendors: ranking.vendors,
      intents: intents.intents,
      purchases: purchases.purchases,
      integration: { status: 'ok' as const },
    });
  } catch (error) {
    console.error("marketplace.summary.failed", error);
    return jsonError({ error: 'upstream_failed', message: 'Failed to fetch marketplace summary.' }, 502);
  }
}

export const runtime = "nodejs";
