import { writeAuditEvent } from "../audit/writeAuditEvent";
import { getWebSupabaseClient } from "./client";
import type { CandidateVendor } from "../discovery/types";

export type ExternalFeedSource =
  | "openai_web_search"
  | "gemini_google_grounding"
  | "maps_places"
  | "social";

export type ExternalFeedItemRow = {
  id: string;
  post_id: string;
  source: ExternalFeedSource;
  title: string;
  snippet: string | null;
  url: string;
  phone: string | null;
  location_text: string | null;
  category_guess: string | null;
  confidence: number | null;
  created_at: string;
};

type ExternalFeedInsert = Omit<ExternalFeedItemRow, "id" | "created_at"> & {
  raw_sources: CandidateVendor["sources"];
};

type FeedPayload = {
  post_id: string;
  source: ExternalFeedSource;
  candidate: CandidateVendor;
};

function pickUrl(candidate: CandidateVendor): string | null {
  if (candidate.website) return candidate.website;
  const firstSource = candidate.sources?.[0];
  if (firstSource?.url) return firstSource.url;
  return null;
}

function buildInsertRow(payload: FeedPayload): ExternalFeedInsert | null {
  const url = pickUrl(payload.candidate);
  if (!url) return null;

  return {
    post_id: payload.post_id,
    source: payload.source,
    title: payload.candidate.name ?? "External option",
    snippet: payload.candidate.sources?.[0]?.snippet ?? null,
    url,
    phone: payload.candidate.phones?.[0] ?? null,
    location_text: payload.candidate.address ?? payload.candidate.area ?? null,
    category_guess: payload.candidate.area ?? null,
    confidence:
      typeof payload.candidate.confidence === "number" ? payload.candidate.confidence : null,
    raw_sources: payload.candidate.sources ?? [],
  };
}

export async function saveExternalFeedItems(
  postId: string,
  source: ExternalFeedSource,
  candidates: CandidateVendor[],
): Promise<ExternalFeedItemRow[]> {
  const client = getWebSupabaseClient();
  const rows = candidates
    .map((candidate) => buildInsertRow({ post_id: postId, source, candidate }))
    .filter((value): value is ExternalFeedInsert => Boolean(value));

  if (!rows.length) {
    return [];
  }

  const { data, error } = await client
    .from("external_feed_items")
    .upsert(rows, { onConflict: "post_id,source,url", ignoreDuplicates: true })
    .select("*");

  if (error) {
    throw new Error(`save_external_feed_items_failed:${error.message}`);
  }

  const inserted = (data ?? []) as ExternalFeedItemRow[];
  await writeAuditEvent({
    request_id: postId,
    event_type: "external_feed_items.stored",
    actor: "system",
    input: { source, candidate_count: rows.length },
    output: { stored_count: inserted.length },
  });

  return inserted;
}

export async function fetchExternalFeedItemsForPost(
  postId: string,
  limit = 10,
): Promise<ExternalFeedItemRow[]> {
  const client = getWebSupabaseClient();
  const { data, error } = await client
    .from("external_feed_items")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { descending: true })
    .limit(limit);

  if (error) {
    throw new Error(`fetch_external_feed_items_failed:${error.message}`);
  }

  return (data ?? []) as ExternalFeedItemRow[];
}
