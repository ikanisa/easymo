#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SORA2_PROMO_ENDPOINT = process.env.SORA2_PROMO_ENDPOINT;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

if (!SORA2_PROMO_ENDPOINT) {
  throw new Error("SORA2_PROMO_ENDPOINT is required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Listing = {
  id: string;
  title: string;
  photos: any[] | null;
};

type ListingMedia = {
  type: string;
  url: string;
  source?: string;
  generated_at?: string;
  poster_for?: string;
};

async function fetchListings(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("produce_listings")
    .select("id, title, photos")
    .eq("video_opt_in", true)
    .in("sora_promo_status", ["pending", "retry"])
    .limit(25);

  if (error) throw error;
  return data ?? [];
}

async function generatePromo(listing: Listing) {
  await supabase
    .from("produce_listings")
    .update({
      sora_promo_status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", listing.id);

  const response = await fetch(SORA2_PROMO_ENDPOINT!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      listingId: listing.id,
      title: listing.title,
    }),
  });

  if (!response.ok) {
    throw new Error(`Sora2 generation failed: ${response.status}`);
  }

  return (await response.json()) as { videoUrl: string; thumbnailUrl: string };
}

async function updateListing(listing: Listing, asset: { videoUrl: string; thumbnailUrl: string }) {
  const existing = (Array.isArray(listing.photos) ? listing.photos : []) as ListingMedia[];
  const generatedAt = new Date().toISOString();
  const retained = existing.filter((photo) =>
    photo && typeof photo.url === "string" && ![asset.videoUrl, asset.thumbnailUrl].includes(photo.url)
  );
  const videoEntry: ListingMedia = {
    type: "video",
    url: asset.videoUrl,
    source: "sora2",
    generated_at: generatedAt,
  };
  const thumbnailEntry: ListingMedia = {
    type: "image",
    url: asset.thumbnailUrl,
    source: "sora2",
    generated_at: generatedAt,
    poster_for: asset.videoUrl,
  };
  const updatedPhotos = [...retained, videoEntry, thumbnailEntry];

  const { error } = await supabase
    .from("produce_listings")
    .update({
      photos: updatedPhotos,
      sora_promo_status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", listing.id);

  if (error) throw error;
}

async function run() {
  const listings = await fetchListings();
  if (!listings.length) {
    console.log("No opted-in listings awaiting promos");
    return;
  }

  for (const listing of listings) {
    try {
      console.log(`Generating Sora-2 promo for ${listing.title}`);
      const asset = await generatePromo(listing);
      await updateListing(listing, asset);
      console.log(`Stored promo for ${listing.id}`);
    } catch (error) {
      console.error(`Failed to build promo for ${listing.id}`, error);
      await supabase
        .from("produce_listings")
        .update({
          sora_promo_status: "retry",
          updated_at: new Date().toISOString(),
        })
        .eq("id", listing.id);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
