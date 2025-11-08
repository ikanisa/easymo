// Web Search Service using SerpAPI and Google APIs
import { getJson } from "npm:serpapi@^2.1.0";

const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");
const GOOGLE_MAPS_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface LocationResult {
  name: string;
  address: string;
  rating?: number;
  phone?: string;
  website?: string;
  distance?: number;
  latitude: number;
  longitude: number;
}

// Web search using SerpAPI
export async function webSearch(
  query: string,
  numResults: number = 10,
): Promise<SearchResult[]> {
  if (!SERPAPI_KEY) {
    throw new Error("SERPAPI_KEY not configured");
  }

  try {
    const response = await getJson({
      engine: "google",
      q: query,
      api_key: SERPAPI_KEY,
      num: numResults,
      gl: "cm", // Cameroon
      hl: "en",
    });

    const results: SearchResult[] = (response.organic_results || []).map(
      (result: any, index: number) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet,
        position: index + 1,
      }),
    );

    return results;
  } catch (error) {
    console.error("Web search error:", error);
    return [];
  }
}

// News search
export async function newsSearch(
  query: string,
  numResults: number = 5,
): Promise<SearchResult[]> {
  if (!SERPAPI_KEY) {
    throw new Error("SERPAPI_KEY not configured");
  }

  try {
    const response = await getJson({
      engine: "google_news",
      q: query,
      api_key: SERPAPI_KEY,
      num: numResults,
      gl: "cm",
    });

    return (response.news_results || []).map((result: any, index: number) => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet || result.source?.name || "",
      position: index + 1,
    }));
  } catch (error) {
    console.error("News search error:", error);
    return [];
  }
}

// Shopping search for price comparisons
export async function shoppingSearch(
  query: string,
  numResults: number = 10,
): Promise<any[]> {
  if (!SERPAPI_KEY) {
    throw new Error("SERPAPI_KEY not configured");
  }

  try {
    const response = await getJson({
      engine: "google_shopping",
      q: query,
      api_key: SERPAPI_KEY,
      num: numResults,
      gl: "cm",
    });

    return (response.shopping_results || []).map((result: any) => ({
      title: result.title,
      link: result.link,
      price: result.price,
      source: result.source,
      rating: result.rating,
      reviews: result.reviews,
      thumbnail: result.thumbnail,
    }));
  } catch (error) {
    console.error("Shopping search error:", error);
    return [];
  }
}

// Location-based search using Google Places
export async function locationSearch(
  query: string,
  latitude: number,
  longitude: number,
  radiusKm: number = 5,
): Promise<LocationResult[]> {
  if (!GOOGLE_MAPS_KEY) {
    console.warn("GOOGLE_MAPS_API_KEY not configured, using fallback");
    return [];
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.append("location", `${latitude},${longitude}`);
    url.searchParams.append("radius", (radiusKm * 1000).toString());
    url.searchParams.append("keyword", query);
    url.searchParams.append("key", GOOGLE_MAPS_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK") {
      throw new Error(`Places API error: ${data.status}`);
    }

    return (data.results || []).map((place: any) => ({
      name: place.name,
      address: place.vicinity,
      rating: place.rating,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      phone: place.formatted_phone_number,
      website: place.website,
    }));
  } catch (error) {
    console.error("Location search error:", error);
    return [];
  }
}

// Get place details
export async function getPlaceDetails(placeId: string): Promise<any> {
  if (!GOOGLE_MAPS_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.append("place_id", placeId);
    url.searchParams.append("key", GOOGLE_MAPS_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    return data.result;
  } catch (error) {
    console.error("Place details error:", error);
    return null;
  }
}

// Get market price information
export async function getMarketPrices(
  product: string,
  location?: string,
): Promise<{ average: number; min: number; max: number; sources: any[] }> {
  const searchQuery = location
    ? `${product} price in ${location}`
    : `${product} price`;

  const shoppingResults = await shoppingSearch(searchQuery, 20);
  
  if (shoppingResults.length === 0) {
    return { average: 0, min: 0, max: 0, sources: [] };
  }

  const prices = shoppingResults
    .map((r) => parsePrice(r.price))
    .filter((p) => p > 0);

  if (prices.length === 0) {
    return { average: 0, min: 0, max: 0, sources: [] };
  }

  return {
    average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    min: Math.min(...prices),
    max: Math.max(...prices),
    sources: shoppingResults.slice(0, 5),
  };
}

// Parse price from string
function parsePrice(priceString: string): number {
  if (!priceString) return 0;
  
  // Remove currency symbols and convert to number
  const cleaned = priceString.replace(/[^0-9.]/g, "");
  const price = parseFloat(cleaned);
  
  return isNaN(price) ? 0 : price;
}

// Get traffic information
export async function getTrafficInfo(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<{ duration: number; distance: number; traffic: string }> {
  if (!GOOGLE_MAPS_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY not configured");
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.append("origin", `${origin.lat},${origin.lng}`);
    url.searchParams.append("destination", `${destination.lat},${destination.lng}`);
    url.searchParams.append("departure_time", "now");
    url.searchParams.append("traffic_model", "best_guess");
    url.searchParams.append("key", GOOGLE_MAPS_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK") {
      throw new Error(`Directions API error: ${data.status}`);
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    return {
      duration: leg.duration_in_traffic?.value || leg.duration.value,
      distance: leg.distance.value,
      traffic: leg.duration_in_traffic ? "available" : "unavailable",
    };
  } catch (error) {
    console.error("Traffic info error:", error);
    throw error;
  }
}

// Get weather information
export async function getWeatherInfo(
  latitude: number,
  longitude: number,
): Promise<any> {
  const WEATHER_API_KEY = Deno.env.get("OPENWEATHER_API_KEY");
  
  if (!WEATHER_API_KEY) {
    console.warn("OPENWEATHER_API_KEY not configured");
    return null;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=metric`;
    const response = await fetch(url);
    const data = await response.json();

    return {
      temperature: data.main.temp,
      condition: data.weather[0].main,
      description: data.weather[0].description,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
    };
  } catch (error) {
    console.error("Weather info error:", error);
    return null;
  }
}

// Comprehensive search combining multiple sources
export async function comprehensiveSearch(query: string): Promise<{
  web: SearchResult[];
  news: SearchResult[];
  shopping: any[];
}> {
  const [web, news, shopping] = await Promise.all([
    webSearch(query, 5),
    newsSearch(query, 3),
    shoppingSearch(query, 5),
  ]);

  return { web, news, shopping };
}
