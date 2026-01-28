import type { ProductListingRow } from "../../web/listingService";
import { publishListing } from "../../web/listingService";

export type WebPublishListingInput = { listing_id: string };

export async function webPublishListing(input: WebPublishListingInput): Promise<ProductListingRow> {
  return publishListing(input.listing_id);
}

