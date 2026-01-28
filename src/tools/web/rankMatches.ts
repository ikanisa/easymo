import type { MarketPost, MatchCandidate, RankedMatch } from "../../web/matchService";
import { rankMatches } from "../../web/matchService";

export type WebRankMatchesInput = {
  post: MarketPost;
  candidates: MatchCandidate[];
  match_type?: RankedMatch["match_type"];
};

export async function webRankMatches(input: WebRankMatchesInput): Promise<RankedMatch[]> {
  return rankMatches(input.post, input.candidates, input.match_type);
}
