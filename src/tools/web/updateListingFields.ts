import type { UpdateListingFieldsInput, ProductListingRow } from "../../web/listingService";
import { updateListingFields } from "../../web/listingService";

export type WebUpdateListingFieldsInput = UpdateListingFieldsInput;

export async function webUpdateListingFields(input: WebUpdateListingFieldsInput): Promise<ProductListingRow> {
  return updateListingFields(input);
}

