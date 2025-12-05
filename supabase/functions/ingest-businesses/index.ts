import { createClient } from "jsr:@supabase/supabase-js@2";
import { logStructuredEvent } from "../_shared/observability.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleMapsApiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY not set');
    }

    const { city, category } = await req.json().catch(() => ({}));
    
    // If city/category provided, run for specific target. Otherwise iterate all (batched).
    // For Edge Function, iterating all might timeout (limit 60s or so).
    // So we default to running a subset or expect params.
    // If no params, we'll just run for Kigali and Pharmacy as a default test, or iterate a few.
    
    const targetCities = city ? [city] : CITIES;
    const targetCategories = category ? [category] : CATEGORIES;

    let totalIngested = 0;
    const MAX_PAGES = 3; 

    for (const currentCity of targetCities) {
      for (const currentCategory of targetCategories) {
        await logStructuredEvent("LOG", { data: `Searching for ${currentCategory} in ${currentCity}...` });
        let nextToken = undefined;
        let pageCount = 0;

        do {
          const query = `${currentCategory} in ${currentCity}, Rwanda`;
          const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
          url.searchParams.append('query', query);
          url.searchParams.append('key', googleMapsApiKey);
          url.searchParams.append('region', 'rw');
          if (nextToken) {
            url.searchParams.append('pagetoken', nextToken);
          }

          const res = await fetch(url.toString());
          const data = await res.json();

          if (!data || !data.results || data.results.length === 0) {
            await logStructuredEvent("LOG", { data: `No results for ${currentCategory} in ${currentCity}` });
            break;
          }

          const results = data.results;
          
          // Process results
          for (const result of results) {
            // Fetch details
            const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
            detailsUrl.searchParams.append('place_id', result.place_id);
            detailsUrl.searchParams.append('key', googleMapsApiKey);
            detailsUrl.searchParams.append('fields', 'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,geometry,opening_hours,types,url');
            
            const detailsRes = await fetch(detailsUrl.toString());
            const detailsData = await detailsRes.json();
            const details = detailsData.result;

            if (!details || (!details.formatted_phone_number && !details.international_phone_number)) {
              continue;
            }

            const business = {
              external_id: result.place_id,
              name: details.name,
              category: CATEGORY_MAPPING[currentCategory] || currentCategory.toLowerCase(),
              city: currentCity,
              address: details.formatted_address || result.formatted_address || `${currentCity}, Rwanda`,
              country: 'Rwanda',
              lat: details.geometry?.location?.lat,
              lng: details.geometry?.location?.lng,
              phone: details.international_phone_number || details.formatted_phone_number,
              website: details.website,
              status: 'NEW',
              rating: details.rating,
              review_count: details.user_ratings_total,
              google_maps_url: details.url,
              place_id: result.place_id,
              business_type: details.types ? details.types[0] : null,
              operating_hours: details.opening_hours,
              source: 'google_places_api',
              updated_at: new Date().toISOString()
            };

            const { error } = await supabaseClient
              .from('businesses')
              .upsert(business, { onConflict: 'external_id' });

            if (error) {
              await logStructuredEvent("ERROR", { data: `Error upserting ${business.name}:`, error.message });
            } else {
              if (business.lat && business.lng) {
                const { error: rpcError } = await supabaseClient.rpc('update_business_location', {
                  biz_id: result.place_id,
                  lat: business.lat,
                  lng: business.lng
                });
                if (rpcError) {
                   // ignore
                }
              }
              totalIngested++;
            }
          }

          nextToken = data.next_page_token;
          pageCount++;
          
          if (nextToken) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } while (nextToken && pageCount < MAX_PAGES);
      }
    }

    return new Response(
      JSON.stringify({ success: true, ingested: totalIngested }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    await logStructuredEvent("ERROR", { data: error });
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
