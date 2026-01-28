import type { PostContext } from "../../web/postService";
import { fetchPostContext } from "../../web/postService";

export type WebFetchPostContextInput = {
  post_id: string;
};

export async function webFetchPostContext(input: WebFetchPostContextInput): Promise<PostContext | null> {
  return fetchPostContext(input.post_id);
}
