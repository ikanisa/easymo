import type { MatchCandidate } from "../../web/matchService";
import { queryInternalMatches } from "../../web/matchService";

export type WebQueryInternalMatchesInput = {
  post_id: string;
};

export async function webQueryInternalMatches(input: WebQueryInternalMatchesInput): Promise<MatchCandidate[]> {
  return queryInternalMatches(input.post_id);
}
