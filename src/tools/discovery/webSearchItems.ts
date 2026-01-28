import type { DiscoveryEngine } from "../discovery/types";
import { saveExternalFeedItems, type ExternalFeedItemRow } from "../../web/externalFeedService";
import { webDiscoverVendors } from "../webDiscoverVendors";

export type DiscoveryWebSearchItemsInput = {
  post_id: string;
  need: string;
  category?: string;
  location_text?: string;
  engine?: DiscoveryEngine;
  max_results?: number;
};

export type DiscoveryWebSearchItemsResult = {
  feed_items: ExternalFeedItemRow[];
  engine: "openai" | "gemini" | "none";
  disabled?: boolean;
  reason?: string;
};

export async function discoveryWebSearchItems(
  input: DiscoveryWebSearchItemsInput,
): Promise<DiscoveryWebSearchItemsResult> {
  const result = await webDiscoverVendors({
    request_id: input.post_id,
    need: input.need,
    category: input.category,
    location_text: input.location_text,
    max_results: input.max_results,
    engine: input.engine,
  });

  if (result.engine === "none" || result.disabled || !result.candidates.length) {
    return {
      feed_items: [],
      engine: result.engine,
      disabled: result.disabled,
      reason: result.reason,
    };
  }

  const source = result.engine === "openai" ? "openai_web_search" : "gemini_google_grounding";
  const feed_items = await saveExternalFeedItems(input.post_id, source, result.candidates);

  return {
    feed_items,
    engine: result.engine,
    reason: result.reason,
    disabled: result.disabled,
  };
}
