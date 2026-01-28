import type { DiscoveryEngine } from "../discovery/types";
import { saveExternalFeedItems, type ExternalFeedItemRow } from "../../web/externalFeedService";
import { socialDiscoverProfiles } from "./socialDiscoverProfiles";

export type DiscoverySocialProfileItemsInput = {
  post_id: string;
  need: string;
  category?: string;
  location_text?: string;
  engine?: DiscoveryEngine;
  max_results?: number;
};

export type DiscoverySocialProfileItemsResult = {
  feed_items: ExternalFeedItemRow[];
  engine: "openai" | "gemini" | "none";
  disabled?: boolean;
  reason?: string;
};

export async function discoverySocialProfileItems(
  input: DiscoverySocialProfileItemsInput,
): Promise<DiscoverySocialProfileItemsResult> {
  const result = await socialDiscoverProfiles({
    request_id: input.post_id,
    need: input.need,
    category: input.category,
    location_text: input.location_text,
    engine: input.engine,
    max_results: input.max_results,
  });

  if (result.engine === "none" || result.disabled || !result.candidates.length) {
    return {
      feed_items: [],
      engine: result.engine,
      disabled: result.disabled,
      reason: result.reason,
    };
  }

  const feed_items = await saveExternalFeedItems(input.post_id, "social", result.candidates);

  return {
    feed_items,
    engine: result.engine,
    disabled: result.disabled,
    reason: result.reason,
  };
}
