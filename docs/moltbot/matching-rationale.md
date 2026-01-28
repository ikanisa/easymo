# Match Ranking Rationale (Workflow WEB-1 Phase 8)

This document explains the deterministic baseline and explainable scoring that Moltbot and the tooling layer must follow when constructing `match_suggestions` for web posts.

## Baseline scoring
1. **Base score**: Every candidate starts at 50 points. This baseline represents a neutral, opposite-type listing before any signals are evaluated.
2. **Signals and deltas** (each must produce a single `reason` entry when triggered):
   - `CATEGORY` (+18) when the seller/buyer category matches exactly.
   - `KEYWORD` (<=12) for shared keywords between the user description/title and the candidate.
   - `PRICE` (+12) when price ranges overlap (buy max >= sell min) or a single price fits inside the target range.
   - `PROXIMITY` (<=10) for geo proximity; closer candidates receive bigger deltas with a textual description of the approximate distance.
   - `RECENCY` (+6) if the candidate was posted within 24 hours.
   - `RESPONSIVENESS` (optional, future) for vendors who historically replied fast.
3. **Delta cap**: Total adjustments from the baseline are bounded between -15 and +15 before the final score is normalized back to the 0–100 range. This keeps Moltbot adjustments explainable and prevents runaway scoring swings.
4. **Match count**: Each `match_suggestions.matches` array must contain at most 10 entries; extras should be truncated by final score.

## Reason requirements
- Every match must include a non-empty `reasons` array; each object must specify `code`, `description`, and optionally `score_delta` so stakeholders understand why the candidate appeared.
- Matching logic must cite the signal source: internal listings, vendor database, or external feed (the `match_type` field already captures this). Example: `"description": "Price 230000 RWF sits inside your 200000-250000 RWF range"` or `"source": "external_feed"` in the surrounding context.
- Moltbot must never revert to prose or unstructured justification—use the `reasons` array to communicate ranking insights.

## Auditability
- The tooling writes `match_suggestions` rows via `web.write_match_suggestions` so each entry is timestamped and includes `reasons` JSON.
- When Postgres stores the entries, `match_suggestions` is index-backed for `(post_id, score DESC)` so UIs can fetch the top matches quickly.
- External signals (web search, maps, social) are stored in `external_feed_items` and their `id` appears as `target_id` when appropriate.

By following this matrix, Moltbot keeps the marketplace explainable, bounded, and auditable while still surfacing the most relevant top-10 matches for every posted request.
