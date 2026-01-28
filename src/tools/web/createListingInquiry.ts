import type { CreateListingInquiryInput, ListingInquiryRow } from "../../web/listingService";
import { createListingInquiry } from "../../web/listingService";

export type WebCreateListingInquiryInput = CreateListingInquiryInput;

export async function webCreateListingInquiry(input: WebCreateListingInquiryInput): Promise<ListingInquiryRow> {
  return createListingInquiry(input);
}

