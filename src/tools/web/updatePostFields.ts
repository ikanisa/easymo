import type { MarketPost, UpdatePostFieldsInput } from "../../web/postService";
import { updatePostFields } from "../../web/postService";

export type WebUpdatePostFieldsInput = UpdatePostFieldsInput;

export async function webUpdatePostFields(input: WebUpdatePostFieldsInput): Promise<MarketPost> {
  return updatePostFields(input);
}
