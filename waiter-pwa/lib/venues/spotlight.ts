"use client";

import { createClient } from "@/lib/supabase";

export interface VenueSpotlight {
  id: string;
  name: string;
  location: string;
  status: string;
  priceRange: string;
  etaLabel: string;
  rating: number;
  reviewCount: number;
  photoUrl: string | null;
  topDish: string;
  liveTables: string;
  sessionsToday: string;
  badges: Array<{ label: string; tone?: "default" | "success" | "warning" }>;
}

const SAMPLE_SPOTLIGHT: VenueSpotlight = {
  id: "sample-maison-verte",
  name: "Maison Verte Bistro",
  location: "KN 3 Ave · Kigali",
  status: "Open now",
  priceRange: "$$",
  etaLabel: "Avg prep 15 min",
  rating: 4.9,
  reviewCount: 320,
  photoUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
  topDish: "Ginger tilapia",
  liveTables: "12 / 18",
  sessionsToday: "8 today",
  badges: [
    { label: "Chef's tasting", tone: "success" },
    { label: "Outdoor seating" },
    { label: "Live music", tone: "warning" },
  ],
};

export async function fetchVenueSpotlight(): Promise<{
  venue: VenueSpotlight;
  isSample: boolean;
}> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("venue_spotlights")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      throw error ?? new Error("No venue spotlight configured");
    }

    return {
      venue: {
        id: data.id ?? crypto.randomUUID(),
        name: data.name ?? SAMPLE_SPOTLIGHT.name,
        location: data.location ?? SAMPLE_SPOTLIGHT.location,
        status: data.status ?? SAMPLE_SPOTLIGHT.status,
        priceRange: data.price_range ?? SAMPLE_SPOTLIGHT.priceRange,
        etaLabel: data.eta_label ?? SAMPLE_SPOTLIGHT.etaLabel,
        rating: typeof data.rating === "number" ? data.rating : SAMPLE_SPOTLIGHT.rating,
        reviewCount: typeof data.review_count === "number" ? data.review_count : SAMPLE_SPOTLIGHT.reviewCount,
        photoUrl: data.photo_url ?? SAMPLE_SPOTLIGHT.photoUrl,
        topDish: data.top_dish ?? SAMPLE_SPOTLIGHT.topDish,
        liveTables: data.live_tables ?? SAMPLE_SPOTLIGHT.liveTables,
        sessionsToday: data.sessions_today ?? SAMPLE_SPOTLIGHT.sessionsToday,
        badges: Array.isArray(data.badges) && data.badges.length ? data.badges : SAMPLE_SPOTLIGHT.badges,
      },
      isSample: false,
    };
  } catch (error) {
    console.warn("waiter-pwa.venue-spotlight.fallback", error);
    return { venue: SAMPLE_SPOTLIGHT, isSample: true };
  }
}
