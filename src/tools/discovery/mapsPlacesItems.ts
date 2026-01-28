import { mapsDiscoverPlaces } from "../mapsDiscoverPlaces";
import { saveExternalFeedItems, type ExternalFeedItemRow } from "../../web/externalFeedService";

export type DiscoveryMapsPlacesItemsInput = {
  post_id: string;
  need: string;
  location_text?: string;
  radius_km?: number;
  max_results?: number;
};

export type DiscoveryMapsPlacesItemsResult = {
  feed_items: ExternalFeedItemRow[];
  disabled?: boolean;
  reason?: string;
};

export async function discoveryMapsPlacesItems(
  input: DiscoveryMapsPlacesItemsInput,
): Promise<DiscoveryMapsPlacesItemsResult> {
  const result = await mapsDiscoverPlaces({
    request_id: input.post_id,
    query: input.need,
    location_text: input.location_text,
    radius_km: input.radius_km,
    max_results: input.max_results,
  });

  if (result.disabled || !result.candidates.length) {
    return {
      feed_items: [],
      disabled: result.disabled,
      reason: result.reason,
    };
  }

  const feed_items = await saveExternalFeedItems(input.post_id, "maps_places", result.candidates);

  return {
    feed_items,
    disabled: result.disabled,
    reason: result.reason,
  };
}
