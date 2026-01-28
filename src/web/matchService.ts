import { getWebSupabaseClient } from "./client";
import { GeoCoordinate, MarketPost, normalizeMarketPost, PostType } from "./postService";

const MAX_INTERNAL_CANDIDATES = 40;
const MAX_SUGGESTIONS = 10;
const BASE_SCORE = 50;
const MAX_DELTA = 15;

export type MatchCandidate = {
  target_id: string;
  type?: PostType;
  category?: string | null;
  title?: string | null;
  description?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  geo?: GeoCoordinate | null;
  posted_at?: string | null;
};

export type RankReason = {
  code: string;
  description: string;
  score_delta?: number;
};

export type RankedMatch = {
  match_type: "internal_listing" | "vendor_db" | "external_feed";
  target_id: string;
  score: number;
  reasons: RankReason[];
};

export async function queryInternalMatches(postId: string): Promise<MatchCandidate[]> {
  const client = getWebSupabaseClient();
  const { data: subjectRow, error: subjectError } = await client
    .from("market_posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  if (subjectError) {
    throw new Error(`query_internal_subject_failed:${subjectError.message}`);
  }

  if (!subjectRow) return [];

  const subject = normalizeMarketPost(subjectRow as Record<string, unknown>);
  const desiredType: PostType = subject.type === "buy" ? "sell" : "buy";

  const { data: rows, error } = await client
    .from("market_posts")
    .select("*")
    .eq("type", desiredType)
    .eq("status", "posted")
    .neq("session_id", subject.session_id)
    .neq("id", postId)
    .order("posted_at", { descending: true })
    .limit(MAX_INTERNAL_CANDIDATES);

  if (error) {
    throw new Error(`query_internal_candidates_failed:${error.message}`);
  }

  const candidates = (rows ?? []) as Record<string, unknown>[];
  return candidates.map((row) => convertToCandidate(normalizeMarketPost(row)));
}

export function rankMatches(
  subject: MarketPost,
  candidates: MatchCandidate[],
  matchType: RankedMatch["match_type"] = "internal_listing",
): RankedMatch[] {
  const baseKeywords = extractKeywords(`${subject.title ?? ""} ${subject.description ?? ""}`);
  const ranked = candidates.map((candidate) => {
    let score = BASE_SCORE;
    let totalDelta = 0;
    const reasons: RankReason[] = [
      {
        code: "BASE_MATCH",
        description: "Candidate is the opposite request type and currently posted",
        score_delta: 0,
      },
    ];

    function applyDelta(delta: number, reason: RankReason) {
      // Enforce per-match bounds so reasons remain consistent with the capped score.
      // This keeps totalDelta within [-MAX_DELTA, MAX_DELTA] while preserving which criteria matched.
      let appliedDelta = delta;
      if (delta > 0) {
        const remaining = MAX_DELTA - totalDelta;
        appliedDelta = Math.min(delta, remaining);
      } else if (delta < 0) {
        const remaining = -MAX_DELTA - totalDelta;
        appliedDelta = Math.max(delta, remaining);
      }

      totalDelta += appliedDelta;
      score += appliedDelta;
      reasons.push({ ...reason, score_delta: Number(appliedDelta.toFixed(1)) });
    }

    if (subject.category && candidate.category && subject.category === candidate.category) {
      applyDelta(18, { code: "CATEGORY", description: "Category matches" });
    }

    const keywordBonus = keywordOverlap(baseKeywords, extractKeywords(`${candidate.title ?? ""} ${candidate.description ?? ""}`));
    if (keywordBonus > 0) {
      const delta = Math.min(12, keywordBonus * 4);
      applyDelta(delta, { code: "KEYWORD", description: "Shared keywords between the descriptions" });
    }

    if (
      subject.price_min !== null &&
      subject.price_max !== null &&
      candidate.price_min !== null &&
      candidate.price_max !== null
    ) {
      const overlap = Math.min(subject.price_max, candidate.price_max) - Math.max(subject.price_min, candidate.price_min);
      if (overlap >= 0) {
        applyDelta(12, { code: "PRICE", description: "Price ranges overlap" });
      }
    }

    if (subject.geo && candidate.geo) {
      const distance = geodistanceKm(subject.geo, candidate.geo);
      const proximityBonus = Math.max(0, 10 - distance / 5);
      if (proximityBonus > 0) {
        const delta = Number(proximityBonus.toFixed(1));
        applyDelta(delta, {
          code: "PROXIMITY",
          description: `Approximately ${distance.toFixed(1)} km away`,
        });
      }
    }

    if (candidate.posted_at) {
      const postedAt = new Date(candidate.posted_at);
      const hoursAgo = (Date.now() - postedAt.getTime()) / 3_600_000;
      if (hoursAgo <= 24) {
        applyDelta(6, { code: "RECENCY", description: "Candidate posted within the last 24 hours" });
      }
    }

    const finalScore = clampScore(score);

    return {
      match_type: matchType,
      target_id: candidate.target_id,
      score: Math.round(finalScore * 10) / 10,
      reasons,
    };
  });

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS);
}

export async function writeMatchSuggestions(postId: string, matches: RankedMatch[]): Promise<void> {
  if (!matches.length) return;
  const client = getWebSupabaseClient();
  const payload = matches.map((match) => ({
    post_id: postId,
    match_type: match.match_type,
    target_id: match.target_id,
    score: match.score,
    reasons: match.reasons,
  }));

  const { error } = await client.from("match_suggestions").insert(payload);
  if (error) {
    throw new Error(`write_match_suggestions_failed:${error.message}`);
  }
}

function convertToCandidate(post: MarketPost): MatchCandidate {
  return {
    target_id: post.id,
    type: post.type,
    category: post.category,
    title: post.title,
    description: post.description,
    price_min: post.price_min,
    price_max: post.price_max,
    geo: post.geo,
    posted_at: post.posted_at,
  };
}

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((chunk) => chunk.length >= 2),
  );
}

function keywordOverlap(a: Set<string>, b: Set<string>): number {
  let overlap = 0;
  a.forEach((entry) => {
    if (b.has(entry)) overlap += 1;
  });
  return overlap;
}

function geodistanceKm(a: GeoCoordinate, b: GeoCoordinate): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const earthRadius = 6_371;
  const h = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}
