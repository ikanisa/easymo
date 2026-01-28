import type { RequestListingVerificationInput, ListingVerificationRequestRow } from "../../web/listingService";
import { requestListingVerification } from "../../web/listingService";

export type WebRequestListingVerificationInput = RequestListingVerificationInput;

export async function webRequestListingVerification(
  input: WebRequestListingVerificationInput,
): Promise<ListingVerificationRequestRow> {
  return requestListingVerification(input);
}

