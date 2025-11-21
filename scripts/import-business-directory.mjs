#!/usr/bin/env node

/**
 * Business Directory Importer
 * 
 * This script retrieves business data from Google Maps via Gemini API
 * and imports it into the Supabase business_directory table.
 * 
 * Usage:
 *   node scripts/import-business-directory.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.warn('⚠️  GEMINI_API_KEY not set - will only work with existing data');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Rwandan cities
const CITIES = [
  'Kigali',
  'Musanze',
  'Rubavu',
  'Gisenyi',
  'Huye',
  'Rwamagana',
  'Muhanga',
  'Nyanza',
  'Rusizi',
  'Karongi'
];

// Business categories from BusinessDirectory.tsx
const CATEGORIES = [
  'Restaurant',
  'Cafe',
  'Coffee Shop',
  'Bar',
  'Hotel',
  'Bank',
  'Pharmacy',
  'Hospital',
  'Clinic',
  'Supermarket',
  'Grocery Store',
  'Hardware Store',
  'Electronics Store',
  'Clothing Store',
  'Bakery',
  'Gas Station',
  'Auto Repair',
  'Beauty Salon',
  'Barber Shop',
  'Gym',
  'School',
  'University',
  'Real Estate',
  'Insurance',
  'Law Firm',
  'Accounting',
  'Construction Company',
  'Furniture Store',
  'Book Store',
  'Market'
];

/**
 * Search for businesses using Google Maps via Gemini API
 */
async function searchBusinessesViaGemini(category, city) {
  if (!GEMINI_API_KEY) {
    console.log(`⚠️  Skipping ${category} in ${city} - no Gemini API key`);
    return [];
  }

  const prompt = `
    Act as a Data Extractor. Search for "${category}" businesses in "${city}, Rwanda" using Google Maps.
    
    Return a valid JSON array of objects. Each object must have:
    - "name": Name of the business
    - "address": Full address
    - "city": City name
    - "phone": Phone number (if available, else "N/A")
    - "category": The business category
    - "rating": Number (0-5)
    - "lat": Latitude (number)
    - "lng": Longitude (number)
    - "website": Website URL (if available, else null)
    - "place_id": Google Place ID (if available)
    
    Return ONLY the raw JSON array, no markdown code blocks.
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearchRetrieval: {} }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.95
          }
        })
      }
    );

    const data = await response.json();
    let jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!jsonStr) return [];

    // Clean markdown if present
    jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    
    const businesses = JSON.parse(jsonStr);
    return Array.isArray(businesses) ? businesses : [];
  } catch (error) {
    console.error(`❌ Error searching ${category} in ${city}:`, error.message);
    return [];
  }
}

/**
 * Transform business data to database format
 */
function transformBusiness(business, batchId) {
  return {
    external_id: business.place_id || `${business.name}-${business.city}`.toLowerCase().replace(/\s+/g, '-'),
    name: business.name,
    category: business.category || 'Unknown',
    city: business.city || 'Rwanda',
    address: business.address || 'N/A',
    country: 'Rwanda',
    lat: business.lat || null,
    lng: business.lng || null,
    phone: business.phone && business.phone !== 'N/A' ? business.phone : null,
    website: business.website || null,
    rating: business.rating || 0,
    status: 'NEW',
    place_id: business.place_id || null,
    source: 'easymoai-gemini',
    import_batch_id: batchId,
    imported_at: new Date().toISOString()
  };
}

/**
 * Insert businesses into Supabase with upsert
 */
async function insertBusinesses(businesses) {
  if (businesses.length === 0) return { count: 0, errors: [] };

  const { data, error } = await supabase
    .from('business_directory')
    .upsert(businesses, {
      onConflict: 'external_id',
      ignoreDuplicates: false
    })
    .select('id');

  if (error) {
    console.error('❌ Insert error:', error);
    return { count: 0, errors: [error] };
  }

  return { count: data?.length || 0, errors: [] };
}

/**
 * Import sample/demo data (when no API key)
 */
async function importDemoData(batchId) {
  console.log('📦 Importing demo business data...');
  
  const demoBusinesses = [
    {
      name: 'Kigali Heights',
      category: 'Hotel',
      city: 'Kigali',
      address: 'KN 4 Ave, Kigali',
      phone: '+250788123456',
      website: 'https://kigaliheights.com',
      rating: 4.5,
      lat: -1.9536,
      lng: 30.0606
    },
    {
      name: 'Heaven Restaurant',
      category: 'Restaurant',
      city: 'Kigali',
      address: 'KG 7 Ave, Kigali',
      phone: '+250788234567',
      rating: 4.8,
      lat: -1.9447,
      lng: 30.0594
    },
    {
      name: 'Bourbon Coffee',
      category: 'Cafe',
      city: 'Kigali',
      address: 'Union Trade Centre, Kigali',
      phone: '+250788345678',
      website: 'https://bourboncoffee.com',
      rating: 4.6,
      lat: -1.9500,
      lng: 30.0588
    }
  ].map(b => transformBusiness(b, batchId));

  return await insertBusinesses(demoBusinesses);
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Starting Business Directory Import');
  console.log('=====================================\n');

  const batchId = randomUUID();
  let totalImported = 0;
  let totalErrors = 0;

  if (!GEMINI_API_KEY) {
    console.log('⚠️  Running in demo mode (no Gemini API key)');
    const result = await importDemoData(batchId);
    totalImported = result.count;
    console.log(`\n✅ Imported ${totalImported} demo businesses`);
  } else {
    console.log(`📍 Cities: ${CITIES.length}`);
    console.log(`📂 Categories: ${CATEGORIES.length}`);
    console.log(`🔄 Batch ID: ${batchId}\n`);

    // Limit to prevent rate limiting - adjust as needed
    const CATEGORIES_TO_FETCH = CATEGORIES.slice(0, 10); // First 10 categories
    const CITIES_TO_FETCH = CITIES.slice(0, 5); // First 5 cities

    for (const city of CITIES_TO_FETCH) {
      for (const category of CATEGORIES_TO_FETCH) {
        console.log(`🔍 Searching: ${category} in ${city}...`);
        
        const businesses = await searchBusinessesViaGemini(category, city);
        
        if (businesses.length > 0) {
          const transformed = businesses.map(b => transformBusiness(b, batchId));
          const result = await insertBusinesses(transformed);
          
          totalImported += result.count;
          totalErrors += result.errors.length;
          
          console.log(`   ✓ Found ${businesses.length}, imported ${result.count}`);
        } else {
          console.log(`   ⊘ No results`);
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.log('\n=====================================');
  console.log('📊 Import Summary');
  console.log('=====================================');
  console.log(`✅ Total imported: ${totalImported}`);
  console.log(`❌ Total errors: ${totalErrors}`);
  console.log(`🔄 Batch ID: ${batchId}`);

  // Get current count
  const { count } = await supabase
    .from('business_directory')
    .select('*', { count: 'exact', head: true });

  console.log(`📈 Total in database: ${count}`);
  console.log('\n✨ Import complete!');
}

// Run
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
