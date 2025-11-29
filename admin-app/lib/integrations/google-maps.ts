import { Client, PlaceInputType,TravelMode } from "@googlemaps/google-maps-services-js";

const client = new Client({});
const API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

export interface Location {
  lat: number;
  lng: number;
}

export interface NearbyPlacesParams {
  location: Location;
  radius: number; // in meters
  type?: string;
  keyword?: string;
}

export interface DirectionsParams {
  origin: Location;
  destination: Location;
  mode?: TravelMode;
  alternatives?: boolean;
}

export interface DistanceMatrixParams {
  origins: Location[];
  destinations: Location[];
  mode?: TravelMode;
}

/**
 * Find nearby places using Google Places API
 * Useful for finding drivers, businesses, etc.
 */
export async function findNearbyPlaces(params: NearbyPlacesParams) {
  if (!API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }

  const response = await client.placesNearby({
    params: {
      location: params.location,
      radius: params.radius,
      type: params.type,
      keyword: params.keyword,
      key: API_KEY,
    },
    timeout: 5000,
  });

  return {
    places: response.data.results,
    status: response.data.status,
    nextPageToken: response.data.next_page_token,
  };
}

/**
 * Get directions between two points
 * Supports multiple travel modes: driving, walking, bicycling, transit
 */
export async function getDirections(params: DirectionsParams) {
  if (!API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }

  const response = await client.directions({
    params: {
      origin: `${params.origin.lat},${params.origin.lng}`,
      destination: `${params.destination.lat},${params.destination.lng}`,
      mode: params.mode ?? TravelMode.driving,
      alternatives: params.alternatives ?? false,
      key: API_KEY,
    },
    timeout: 5000,
  });

  if (response.data.routes.length === 0) {
    throw new Error("No routes found");
  }

  const route = response.data.routes[0];
  const leg = route.legs[0];

  return {
    route,
    distance: leg.distance,
    duration: leg.duration,
    startAddress: leg.start_address,
    endAddress: leg.end_address,
    steps: leg.steps,
  };
}

/**
 * Calculate distance matrix for multiple origins and destinations
 * Useful for finding nearest driver/location
 */
export async function calculateDistanceMatrix(params: DistanceMatrixParams) {
  if (!API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }

  const response = await client.distancematrix({
    params: {
      origins: params.origins.map((o) => `${o.lat},${o.lng}`),
      destinations: params.destinations.map((d) => `${d.lat},${d.lng}`),
      mode: params.mode ?? TravelMode.driving,
      key: API_KEY,
    },
    timeout: 5000,
  });

  return {
    rows: response.data.rows,
    originAddresses: response.data.origin_addresses,
    destinationAddresses: response.data.destination_addresses,
  };
}

/**
 * Search for a place by text query
 * Example: "restaurants near me", "pharmacies in Kigali"
 */
export async function searchPlaceByText(query: string) {
  if (!API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }

  const response = await client.findPlaceFromText({
    params: {
      input: query,
      inputtype: PlaceInputType.textQuery,
      fields: [
        "place_id",
        "name",
        "formatted_address",
        "geometry",
        "rating",
        "opening_hours",
      ],
      key: API_KEY,
    },
    timeout: 5000,
  });

  return {
    candidates: response.data.candidates,
    status: response.data.status,
  };
}

/**
 * Get place details by place ID
 */
export async function getPlaceDetails(placeId: string) {
  if (!API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }

  const response = await client.placeDetails({
    params: {
      place_id: placeId,
      fields: [
        "name",
        "formatted_address",
        "formatted_phone_number",
        "geometry",
        "opening_hours",
        "rating",
        "user_ratings_total",
        "website",
        "photos",
      ],
      key: API_KEY,
    },
    timeout: 5000,
  });

  return response.data.result;
}

/**
 * Geocode an address to get coordinates
 */
export async function geocodeAddress(address: string) {
  if (!API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }

  const response = await client.geocode({
    params: {
      address,
      key: API_KEY,
    },
    timeout: 5000,
  });

  if (response.data.results.length === 0) {
    throw new Error("Address not found");
  }

  const result = response.data.results[0];
  return {
    location: result.geometry.location,
    formattedAddress: result.formatted_address,
    placeId: result.place_id,
  };
}

/**
 * Reverse geocode coordinates to get address
 */
export async function reverseGeocode(location: Location) {
  if (!API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }

  const response = await client.reverseGeocode({
    params: {
      latlng: location,
      key: API_KEY,
    },
    timeout: 5000,
  });

  if (response.data.results.length === 0) {
    throw new Error("Location not found");
  }

  return {
    address: response.data.results[0].formatted_address,
    results: response.data.results,
  };
}
