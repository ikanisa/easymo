import type { RankedMatch } from "../../web/matchService";
import { writeMatchSuggestions } from "../../web/matchService";

export type WebWriteMatchSuggestionsInput = {
  post_id: string;
  matches: RankedMatch[];
};

export async function webWriteMatchSuggestions(input: WebWriteMatchSuggestionsInput): Promise<void> {
  return writeMatchSuggestions(input.post_id, input.matches);
}
