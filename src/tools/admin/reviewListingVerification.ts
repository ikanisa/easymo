import type { ReviewListingVerificationInput } from "../../web/listingService";
import { reviewListingVerification } from "../../web/listingService";

export type AdminReviewListingVerificationInput = ReviewListingVerificationInput;

export async function adminReviewListingVerification(input: AdminReviewListingVerificationInput) {
  return reviewListingVerification(input);
}

