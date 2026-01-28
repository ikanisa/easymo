import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from root .env
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_MAPS_API_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or GOOGLE_MAPS_API_KEY');
  process.exit(1);
}

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

async function searchGooglePlaces(query: string, pageToken?: string) {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: query,
        key: GOOGLE_MAPS_API_KEY,
        pagetoken: pageToken,
        region: 'rw'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error searching Google Places for "${query}":`, error.message);
    return null;
  }
}

async function getPlaceDetails(placeId: string) {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        key: GOOGLE_MAPS_API_KEY,
        fields: 'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,geometry,opening_hours,types,url'
      }
    });
    return response.data.result;
  } catch (error) {
    console.error(`Error fetching details for ${placeId}:`, error.message);
    return null;
  }
}

async function processResults(results: any[], category: string, city: string) {
  let count = 0;
  
  for (const result of results) {
    // Fetch details to get phone number and website if not in search results (Text Search returns some but Details is better)
    // To save quota, we can check if formatted_phone_number is in result (Text Search usually returns it? No, mostly basic info).
    // Actually Text Search returns 'formatted_address', 'geometry', 'icon', 'name', 'photos', 'place_id', 'reference', 'types'.
    // It does NOT return phone number usually. We need Place Details.
    // But fetching details for every result is expensive (1 request per result).
    // Let's try to just use what we have if possible, or fetch details.
    // The user wants "businesses with phone numbers".
    // So we MUST fetch details or use a search that returns it.
    // Text Search (New) or Nearby Search (New) might return it in the mask.
    // But we are using the "Old" Text Search (v1) via axios.
    
    // Let's fetch details.
    const details = await getPlaceDetails(result.place_id);
    if (!details || (!details.formatted_phone_number && !details.international_phone_number)) {
      continue;
    }

    const business = {
      external_id: result.place_id,
      name: details.name,
      category: CATEGORY_MAPPING[category] || category.toLowerCase(),
      city: city,
      address: details.formatted_address || result.formatted_address || `${city}, Rwanda`,
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

    // Upsert into Supabase
    const { error } = await supabase
      .from('business_directory')
      .upsert(business, { onConflict: 'external_id' });

    if (error) {
      console.error(`Error upserting ${business.name}:`, error.message);
    } else {
      // Update location column (PostGIS)
      if (business.lat && business.lng) {
        const { error: rpcError } = await supabase.rpc('update_business_location', {
          biz_id: result.place_id,
          lat: business.lat,
          lng: business.lng
        });
        if (rpcError) {
          // console.error('Failed to update location:', rpcError);
        }
      }
      count++;
    }
    
    // Rate limiting for details
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return count;
}

async function main() {
  console.log('Starting business ingestion with Google Places API...');
  let totalIngested = 0;

  for (const city of CITIES) {
    for (const category of CATEGORIES) {
      console.log(`Searching for ${category} in ${city}...`);
      let nextToken = undefined;
      let pageCount = 0;
      const MAX_PAGES = 3; // Google Places limit is 60 results (3 pages)

      do {
        const data = await searchGooglePlaces(`${category} in ${city}, Rwanda`, nextToken);

        if (!data || !data.results || data.results.length === 0) {
          console.log(`No results for ${category} in ${city}`);
          break;
        }

        const results = data.results;
        const ingested = await processResults(results, category, city);
        totalIngested += ingested;
        console.log(`  Page ${pageCount + 1}: Ingested ${ingested} businesses`);

        nextToken = data.next_page_token;
        pageCount++;
        
        if (nextToken) {
          // Must wait a bit before next_page_token is valid
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } while (nextToken && pageCount < MAX_PAGES);
    }
  }

  console.log(`Ingestion complete. Total businesses ingested: ${totalIngested}`);
}

main().catch(console.error);
