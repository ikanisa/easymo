export type MatchReason = {
  code: string;
  description: string;
  score_delta?: number;
};

export type MatchSuggestion = {
  target_id: string;
  match_type: "internal_listing" | "vendor_db" | "external_feed";
  score: number;
  reasons: MatchReason[];
};

type MatchCardProps = {
  match: MatchSuggestion;
};

export function MatchCard({ match }: MatchCardProps) {
  const badgeLabel = match.match_type === "internal_listing" ? "Internal" : match.match_type === "vendor_db" ? "Vendor" : "External";

  return (
    <article className="match-card">
      <header>
        <div>
          <p className="match-score">{match.score.toFixed(1)}</p>
          <p className="match-label">{badgeLabel}</p>
        </div>
        <span className="match-target">{match.target_id.slice(0, 8)}…</span>
      </header>
      <ul>
        {match.reasons.map((reason) => (
          <li key={reason.code}>
            <span>{reason.code}</span>
            <p>{reason.description}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
