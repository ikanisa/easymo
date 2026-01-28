import type { SearchResult } from "./types";

export type MapsSearchOptions = {
  query: string;
  location?: string;
  radiusKm?: number;
  maxResults: number;
};

const DEFAULT_RADIUS_KM = 5;
const DEFAULT_MAX_RESULTS = 10;

function toMeters(km: number): number {
  return Math.round(km * 1000);
}

function mapPlaceToResult(place: any): SearchResult {
  return {
    title: place?.name,
    url: place?.website || place?.url,
    snippet: place?.formatted_address || place?.vicinity,
  };
}

export async function searchWithGoogleMaps(options: MapsSearchOptions): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return [];
  }

  const query = options.query;
  const radiusKm = options.radiusKm ?? DEFAULT_RADIUS_KM;
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;

  const params = new URLSearchParams({
    key: apiKey,
    query,
  });
  if (options.location) {
    params.set("location", options.location);
    params.set("radius", String(toMeters(radiusKm)));
  }

  const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`;
  const response = await fetch(textSearchUrl);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`google_maps_textsearch_failed:${response.status}:${text}`);
  }

  const payload = await response.json();
  const places = Array.isArray(payload.results) ? payload.results.slice(0, maxResults) : [];

  // Enrich with place details when possible (phone/address/website)
  const results: SearchResult[] = [];
  for (const place of places) {
    if (!place?.place_id) {
      results.push(mapPlaceToResult(place));
      continue;
    }

    const detailsParams = new URLSearchParams({
      key: apiKey,
      place_id: place.place_id,
      fields: "name,formatted_address,international_phone_number,formatted_phone_number,website,url",
    });

    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?${detailsParams.toString()}`;
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) {
      results.push(mapPlaceToResult(place));
      continue;
    }

    const detailsPayload = await detailsResponse.json();
    const details = detailsPayload?.result ?? place;
    const snippetParts = [
      details?.formatted_address,
      details?.international_phone_number ?? details?.formatted_phone_number,
    ].filter(Boolean);

    results.push({
      title: details?.name ?? place?.name,
      url: details?.website || details?.url,
      snippet: snippetParts.join(" | ") || place?.formatted_address || place?.vicinity,
    });
  }

  return results.slice(0, maxResults);
}
