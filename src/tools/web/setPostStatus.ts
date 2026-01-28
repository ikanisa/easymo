import type { MarketPost, SetPostStatusInput } from "../../web/postService";
import { setPostStatus } from "../../web/postService";

export type WebSetPostStatusInput = SetPostStatusInput;

export async function webSetPostStatus(input: WebSetPostStatusInput): Promise<MarketPost> {
  return setPostStatus(input);
}
