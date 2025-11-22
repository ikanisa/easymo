import { createClient } from 'jsr:@supabase/supabase-js@2';

const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const CATEGORIES = [
  "Pharmacy", "Hardware Store", "Restaurant", "Hotel", "Supermarket", 
  "Bank", "Hospital", "Clinic", "School", "University", "Gym", 
  "Beauty Salon", "Car Repair", "Lawyer", "Accountant", "Real Estate Agency", 
  "Coffee Shop", "Bakery", "Bar", "Night Club", "Shopping Mall", 
  "Electronics Store", "Furniture Store", "Clothing Store", "Gas Station"
];

const CITIES = [
  "Kigali", "Musanze", "Rubavu", "Huye", "Rusizi", 
  "Muhanga", "Rwamagana", "Nyagatare"
];

const CATEGORY_MAPPING: Record<string, string> = {
  "Pharmacy": "pharmacy",
  "Hardware Store": "hardware_store",
  "Restaurant": "restaurant",
  "Hotel": "hotel",
  "Supermarket": "supermarket",
  "Bank": "bank",
  "Hospital": "hospital",
  "Clinic": "clinic",
  "School": "school",
  "University": "university",
  "Gym": "gym",
  "Beauty Salon": "beauty_salon",
  "Car Repair": "car_repair",
  "Lawyer": "lawyer",
  "Accountant": "accountant",
  "Real Estate Agency": "real_estate_agency",
  "Coffee Shop": "cafe",
  "Bakery": "bakery",
  "Bar": "bar",
  "Night Club": "night_club",
  "Shopping Mall": "shopping_mall",
  "Electronics Store": "electronics_store",
  "Furniture Store": "furniture_store",
  "Clothing Store": "clothing_store",
  "Gas Station": "gas_station"
};

async function searchGoogleMaps(query: string, start: number = 0) {
  try {
    const url = new URL('https://serpapi.com/search');
    url.searchParams.append('engine', 'google_maps');
    url.searchParams.append('q', query);
    url.searchParams.append('api_key', SERPAPI_KEY!);
    url.searchParams.append('type', 'search');
    url.searchParams.append('start', start.toString());
    url.searchParams.append('hl', 'en');
    url.searchParams.append('gl', 'rw');
    url.searchParams.append('ll', '@-1.9441,30.0619,10z');

    const response = await fetch(url.toString());
    return await response.json();
  } catch (error) {
    console.error(`Error searching Google Maps for "${query}":`, error);
    return null;
  }
}

async function processResults(results: any[], category: string, city: string) {
  let count = 0;
  
  for (const result of results) {
    if (!result.phone) continue;

    const business = {
      external_id: result.place_id,
      name: result.title,
      category: CATEGORY_MAPPING[category] || category.toLowerCase(),
      city: city,
      address: result.address || `${city}, Rwanda`,
      country: 'Rwanda',
      lat: result.gps_coordinates?.latitude,
      lng: result.gps_coordinates?.longitude,
      phone: result.phone,
      website: result.website,
      status: 'NEW',
      rating: result.rating,
      review_count: result.reviews,
      google_maps_url: result.links?.google_maps_url,
      place_id: result.place_id,
      business_type: result.type,
      operating_hours: result.operating_hours,
      source: 'google_maps_serpapi',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('business_directory')
      .upsert(business, { onConflict: 'external_id' });

    if (error) {
      console.error(`Error upserting ${business.name}:`, error.message);
    } else {
      if (business.lat && business.lng) {
        await supabase.rpc('update_business_location', {
          biz_id: result.place_id,
          lat: business.lat,
          lng: business.lng
        }).catch(() => {});
      }
      count++;
    }
  }
  return count;
}

Deno.serve(async (req) => {
  if (!SERPAPI_KEY) {
    return new Response("Missing SERPAPI_KEY", { status: 500 });
  }

  const { category, city } = await req.json().catch(() => ({})) as { category?: string, city?: string };
  
  // If params provided, run specific search. Else run a small batch or fail.
  // To run full ingestion, we might need to chain calls or use a background worker pattern.
  // For now, let's default to running a batch for "Kigali" and "Pharmacy" if not specified, 
  // or iterate a few.
  
  const targetCategories = category ? [category] : CATEGORIES.slice(0, 2); // Limit for single run
  const targetCities = city ? [city] : ["Kigali"];

  let totalIngested = 0;

  for (const c of targetCities) {
    for (const cat of targetCategories) {
      console.log(`Searching for ${cat} in ${c}...`);
      let start = 0;
      let hasMore = true;
      let pageCount = 0;
      const MAX_PAGES = 3; // Limit per invocation

      while (hasMore && pageCount < MAX_PAGES) {
        const query = `${cat} in ${c}, Rwanda`;
        const data = await searchGoogleMaps(query, start);

        if (!data || !data.local_results) {
          hasMore = false;
          break;
        }

        const results = data.local_results;
        const ingested = await processResults(results, cat, c);
        totalIngested += ingested;

        if (data.serpapi_pagination?.next) {
          start += 20;
          pageCount++;
        } else {
          hasMore = false;
        }
      }
    }
  }

  return new Response(JSON.stringify({ success: true, ingested: totalIngested }), {
    headers: { "Content-Type": "application/json" },
  });
});
