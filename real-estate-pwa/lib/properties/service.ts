import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  mockFeaturedProperties,
  type FeaturedProperty,
} from "./mock-data";

type Row = {
  id?: string;
  name?: string;
  location?: string;
  price_range?: string;
  rating?: number;
  reviews?: number;
  status_label?: string;
  eta_label?: string;
  photo_url?: string;
  badges?: Array<{ label: string; tone?: "default" | "success" | "warning" }>;
  highlights?: Array<{ label: string; value: string }>;
};

function mapRow(row: Row): FeaturedProperty {
  return {
    id: row.id ?? crypto.randomUUID(),
    name: row.name ?? "Untitled property",
    location: row.location ?? "Unknown location",
    priceRange: row.price_range ?? "—",
    rating: typeof row.rating === "number" ? row.rating : 0,
    reviews: typeof row.reviews === "number" ? row.reviews : 0,
    status: row.status_label ?? "New",
    etaLabel: row.eta_label ?? "",
    photoUrl: row.photo_url ?? undefined,
    badges: Array.isArray(row.badges) ? row.badges : [],
    highlights: Array.isArray(row.highlights) ? row.highlights : [],
  };
}

async function fetchFromSupabase(client: SupabaseClient) {
  const { data, error } = await client
    .from("property_highlights")
    .select("id,name,location,price_range,rating,reviews,status_label,eta_label,photo_url,badges,highlights")
    .order("rating", { ascending: false })
    .limit(6);

  if (error || !data) {
    throw error ?? new Error("No data returned");
  }

  return data.map(mapRow);
}

export async function fetchFeaturedProperties(): Promise<{
  properties: FeaturedProperty[];
  isSample: boolean;
}> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { properties: mockFeaturedProperties, isSample: true };
  }

  try {
    const properties = await fetchFromSupabase(supabase);
    if (!properties.length) {
      return { properties: mockFeaturedProperties, isSample: true };
    }
    return { properties, isSample: false };
  } catch (error) {
    console.warn("real-estate-pwa.featured-properties.failed", error);
    return { properties: mockFeaturedProperties, isSample: true };
  }
}
