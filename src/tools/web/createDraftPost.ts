import type { CreateDraftPostInput, MarketPost } from "../../web/postService";
import { createDraftPost } from "../../web/postService";

export type WebCreateDraftPostInput = CreateDraftPostInput;

export async function webCreateDraftPost(input: WebCreateDraftPostInput): Promise<MarketPost> {
  return createDraftPost(input);
}
