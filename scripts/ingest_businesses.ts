import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from root .env
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const SERPAPI_KEY = process.env.SERPAPI_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SERPAPI_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SERPAPI_KEY');
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

// Google Maps Categories Mapping (for cleaner database categories)
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
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_maps',
        q: query,
        api_key: SERPAPI_KEY,
        type: 'search',
        start: start,
        hl: 'en', // Language English
        gl: 'rw', // Region Rwanda
        ll: '@-1.9441,30.0619,10z' // Centered on Kigali, zoom 10
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error searching Google Maps for "${query}":`, error.message);
    return null;
  }
}

async function processResults(results: any[], category: string, city: string) {
  let count = 0;
  
  for (const result of results) {
    // Filter: Must have phone number
    if (!result.phone) {
      continue;
    }

    const business = {
      external_id: result.place_id, // Use place_id as external_id
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

    // Upsert into Supabase
    const { error } = await supabase
      .from('business_directory')
      .upsert(business, { onConflict: 'external_id' });

    if (error) {
      console.error(`Error upserting ${business.name}:`, error.message);
    } else {
      // Update location column (PostGIS)
      if (business.lat && business.lng) {
        await supabase.rpc('update_business_location', {
          biz_id: result.place_id,
          lat: business.lat,
          lng: business.lng
        }).catch(() => {
           // Fallback if RPC doesn't exist, try raw SQL if possible or ignore
           // Ideally we should have a trigger or use raw query, but client doesn't support raw query easily without RPC
           // For now, we rely on the migration to have added the column, but we need to populate it.
           // We can do a second update using raw SQL via a function if needed, or just rely on lat/lng columns for now
           // and have a background job update the geography column.
        });
      }
      count++;
    }
  }
  return count;
}

async function main() {
  console.log('Starting business ingestion...');
  let totalIngested = 0;

  for (const city of CITIES) {
    for (const category of CATEGORIES) {
      console.log(`Searching for ${category} in ${city}...`);
      let start = 0;
      let hasMore = true;
      let pageCount = 0;
      const MAX_PAGES = 5; // Limit pages per category/city to avoid excessive API usage during testing

      while (hasMore && pageCount < MAX_PAGES) {
        const query = `${category} in ${city}, Rwanda`;
        const data = await searchGoogleMaps(query, start);

        if (!data || !data.local_results) {
          console.log(`No results for ${query}`);
          hasMore = false;
          break;
        }

        const results = data.local_results;
        const ingested = await processResults(results, category, city);
        totalIngested += ingested;
        console.log(`  Page ${pageCount + 1}: Ingested ${ingested} businesses`);

        if (data.serpapi_pagination?.next) {
          start += 20; // Google Maps usually 20 per page
          pageCount++;
          // Rate limiting to be nice
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          hasMore = false;
        }
      }
    }
  }

  console.log(`Ingestion complete. Total businesses ingested: ${totalIngested}`);
}

main().catch(console.error);
