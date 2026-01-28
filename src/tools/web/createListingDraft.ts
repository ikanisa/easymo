import type { CreateListingDraftInput, ProductListingRow } from "../../web/listingService";
import { createListingDraft } from "../../web/listingService";

export type WebCreateListingDraftInput = CreateListingDraftInput;

export async function webCreateListingDraft(input: WebCreateListingDraftInput): Promise<ProductListingRow> {
  return createListingDraft(input);
}

