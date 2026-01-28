import type { ListPublishedListingsInput, ListingCard } from "../../web/listingService";
import { listPublishedListings } from "../../web/listingService";

export type WebListPublishedListingsInput = ListPublishedListingsInput;

export async function webListPublishedListings(input: WebListPublishedListingsInput): Promise<ListingCard[]> {
  return listPublishedListings(input);
}

