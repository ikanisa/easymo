import { getWebSupabaseClient } from "./client";
import type { WebSessionRecord } from "./sessionService";
import { ExternalFeedItemRow, fetchExternalFeedItemsForPost } from "./externalFeedService";
import { ensureSessionCanPost } from "./moderationService";

export type PostType = "buy" | "sell";
export type PostStatus = "draft" | "posted" | "matched" | "closed";

export type GeoCoordinate = {
  latitude: number;
  longitude: number;
};

export type MarketPost = {
  id: string;
  session_id: string;
  type: PostType;
  category: string | null;
  title: string | null;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string;
  location_text: string | null;
  geo: GeoCoordinate | null;
  media_urls: string[];
  status: PostStatus;
  created_at: string;
  posted_at: string | null;
  web_sessions?: Pick<WebSessionRecord, "id" | "anon_user_id" | "language">;
};

export type CreateDraftPostInput = {
  session_id: string;
  type: PostType;
  category?: string;
  title?: string;
  description?: string;
  price_min?: number;
  price_max?: number;
  currency?: string;
  location_text?: string;
  geo?: GeoCoordinate;
  media_urls?: string[];
};

export type UpdatePostFieldsInput = {
  post_id: string;
  fields: Partial<
    Pick<
      MarketPost,
      "category" | "title" | "description" | "price_min" | "price_max" | "currency" | "location_text" | "geo" | "media_urls" | "type" | "status"
    >
  >;
};

export type SetPostStatusInput = {
  post_id: string;
  status: PostStatus;
  posted_at?: string;
};

export type PostContext = {
  post: MarketPost;
  match_suggestions: unknown[];
  notifications: unknown[];
  external_feed_items: ExternalFeedItemRow[];
};

function formatGeo(geo?: GeoCoordinate): string | null {
  if (!geo) return null;
  return `(${geo.longitude},${geo.latitude})`;
}

function parseGeoValue(value: unknown): GeoCoordinate | null {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.replace(/[()\s]/g, "");
    const [lng, lat] = trimmed.split(",");
    if (!lat || !lng) return null;
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
    return { latitude, longitude };
  }

  if (typeof value === "object" && value !== null) {
    const candidate = value as Record<string, unknown>;
    const latitude = candidate.y ?? candidate.latitude ?? candidate.lat;
    const longitude = candidate.x ?? candidate.longitude ?? candidate.lng;
    if (typeof latitude === "number" && typeof longitude === "number") {
      return { latitude, longitude };
    }
  }

  return null;
}

export function normalizeMarketPost(row: Record<string, unknown>): MarketPost {
  return {
    id: String(row.id),
    session_id: String(row.session_id),
    type: (row.type as PostType) ?? "buy",
    category: row.category as string | null,
    title: row.title as string | null,
    description: row.description as string | null,
    price_min: typeof row.price_min === "number" ? row.price_min : null,
    price_max: typeof row.price_max === "number" ? row.price_max : null,
    currency: (row.currency as string) ?? "RWF",
    location_text: row.location_text as string | null,
    geo: parseGeoValue(row.geo),
    media_urls: Array.isArray(row.media_urls) ? (row.media_urls as string[]) : [],
    status: (row.status as PostStatus) ?? "draft",
    created_at: String(row.created_at),
    posted_at:
      row.posted_at === null || row.posted_at === undefined ? null : String(row.posted_at),
    web_sessions: row.web_sessions as MarketPost["web_sessions"],
  };
}

export async function createDraftPost(input: CreateDraftPostInput): Promise<MarketPost> {
  const client = getWebSupabaseClient();
  await ensureSessionCanPost(input.session_id);
  const { data, error } = await client
    .from("market_posts")
    .insert({
      session_id: input.session_id,
      type: input.type,
      category: input.category ?? null,
      title: input.title ?? null,
      description: input.description ?? null,
      price_min: input.price_min ?? null,
      price_max: input.price_max ?? null,
      currency: input.currency ?? "RWF",
      location_text: input.location_text ?? null,
      geo: formatGeo(input.geo),
      media_urls: input.media_urls ?? [],
      status: "draft",
    })
    .select("*, web_sessions(id, anon_user_id, language)")
    .single();

  if (error) {
    throw new Error(`create_draft_post_failed:${error.message}`);
  }

  return normalizeMarketPost(data as Record<string, unknown>);
}

export async function updatePostFields(input: UpdatePostFieldsInput): Promise<MarketPost> {
  const client = getWebSupabaseClient();
  const mergedFields = {
    ...input.fields,
    geo: input.fields.geo ? formatGeo(input.fields.geo) : input.fields.geo ?? null,
  } as Record<string, unknown>;

  const { data, error } = await client
    .from("market_posts")
    .update(mergedFields)
    .eq("id", input.post_id)
    .select("*, web_sessions(id, anon_user_id, language)")
    .single();

  if (error) {
    throw new Error(`update_post_fields_failed:${error.message}`);
  }

  return normalizeMarketPost(data as Record<string, unknown>);
}

export async function setPostStatus(input: SetPostStatusInput): Promise<MarketPost> {
  const client = getWebSupabaseClient();
  const { data, error } = await client
    .from("market_posts")
    .update({
      status: input.status,
      posted_at: input.posted_at ?? (input.status === "posted" ? new Date().toISOString() : null),
    })
    .eq("id", input.post_id)
    .select("*, web_sessions(id, anon_user_id, language)")
    .single();

  if (error) {
    throw new Error(`set_post_status_failed:${error.message}`);
  }

  return normalizeMarketPost(data as Record<string, unknown>);
}

export async function fetchPostContext(postId: string): Promise<PostContext | null> {
  const client = getWebSupabaseClient();
  const { data: post, error: postError } = await client
    .from("market_posts")
    .select("*, web_sessions(id, anon_user_id, language)")
    .eq("id", postId)
    .maybeSingle();

  if (postError) {
    throw new Error(`fetch_post_failed:${postError.message}`);
  }

  if (!post) return null;

  const [{ data: matchSuggestions }, { data: notifications }] = await Promise.all([
    client
      .from("match_suggestions")
      .select("*")
      .eq("post_id", postId)
      .order("score", { ascending: false }),
    client
      .from("web_notifications")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: false }),
  ]);
  const externalFeeds = await fetchExternalFeedItemsForPost(postId);

  return {
    post: normalizeMarketPost(post as Record<string, unknown>),
    match_suggestions: matchSuggestions ?? [],
    notifications: notifications ?? [],
    external_feed_items: externalFeeds,
  };
}
