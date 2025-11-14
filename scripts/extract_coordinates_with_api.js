#!/usr/bin/env node
/**
 * Extract Coordinates from Google Maps URLs and Addresses
 * Uses Google Maps Geocoding API
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Configuration
const GOOGLE_MAPS_API_KEY = 'AIzaSyB8B8N2scJAWMs05f-xGRVzQAb4MQIuNEU';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lhbowpbcpwoiparwnwgt.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Extract coordinates from Google Maps URL
 * Formats supported:
 * - https://maps.google.com/?q=-1.9536,30.0606
 * - https://www.google.com/maps/place/Name/@-1.9536,30.0606,17z
 * - https://goo.gl/maps/xxx (shortened URL)
 */
function extractCoordsFromUrl(url) {
  if (!url) return null;

  // Pattern 1: @lat,lng format
  const match1 = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (match1) {
    return {
      latitude: parseFloat(match1[1]),
      longitude: parseFloat(match1[2]),
    };
  }

  // Pattern 2: ?q=lat,lng format
  const match2 = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (match2) {
    return {
      latitude: parseFloat(match2[1]),
      longitude: parseFloat(match2[2]),
    };
  }

  return null;
}

/**
 * Geocode address using Google Maps Geocoding API
 */
async function geocodeAddress(address) {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address: address,
          key: GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
        formatted_address: response.data.results[0].formatted_address,
      };
    }

    console.warn(`⚠️  Geocoding failed for: ${address} (${response.data.status})`);
    return null;
  } catch (error) {
    console.error(`❌ Error geocoding address: ${address}`, error.message);
    return null;
  }
}

/**
 * Process a single business
 */
async function processBusiness(business) {
  console.log(`\n📍 Processing: ${business.name}`);

  let coords = null;

  // Step 1: Try to extract from Google Maps URL
  if (business.google_maps_url) {
    coords = extractCoordsFromUrl(business.google_maps_url);
    if (coords) {
      console.log(`  ✓ Extracted from URL: ${coords.latitude}, ${coords.longitude}`);
    }
  }

  // Step 2: If no coords from URL, try geocoding the address
  if (!coords && business.address) {
    console.log(`  🔍 Geocoding address: ${business.address}`);
    const geocoded = await geocodeAddress(business.address);
    if (geocoded) {
      coords = {
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
      };
      console.log(`  ✓ Geocoded: ${coords.latitude}, ${coords.longitude}`);
    }
  }

  // Step 3: Update database if coordinates found
  if (coords) {
    const { error } = await supabase
      .from('businesses')
      .update({
        latitude: coords.latitude,
        longitude: coords.longitude,
        updated_at: new Date().toISOString(),
      })
      .eq('id', business.id);

    if (error) {
      console.error(`  ❌ Failed to update: ${error.message}`);
      return false;
    }

    console.log(`  ✅ Updated database`);
    return true;
  }

  console.log(`  ⚠️  No coordinates found`);
  return false;
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                    ║');
  console.log('║        EXTRACT COORDINATES FROM GOOGLE MAPS URLS                   ║');
  console.log('║                                                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Fetch businesses without coordinates
  console.log('📊 Fetching businesses without coordinates...');
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, name, address, google_maps_url, latitude, longitude')
    .or('latitude.is.null,longitude.is.null')
    .not('address', 'is', null)
    .order('name');

  if (error) {
    console.error('❌ Error fetching businesses:', error);
    process.exit(1);
  }

  console.log(`✓ Found ${businesses.length} businesses needing coordinates\n`);

  if (businesses.length === 0) {
    console.log('✅ All businesses already have coordinates!');
    return;
  }

  // Process each business
  let successCount = 0;
  let failCount = 0;

  for (const business of businesses) {
    const success = await processBusiness(business);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Rate limiting: Wait 200ms between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                           SUMMARY                                  ');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`⚠️  Failed to geocode: ${failCount}`);
  console.log(`📊 Total processed: ${businesses.length}`);
  console.log('═══════════════════════════════════════════════════════════════════');

  // Check completion
  const { data: stats } = await supabase
    .from('businesses')
    .select('id, latitude, longitude');

  if (stats) {
    const total = stats.length;
    const withCoords = stats.filter(b => b.latitude && b.longitude).length;
    const percentage = ((withCoords / total) * 100).toFixed(2);

    console.log('');
    console.log('📈 Database Status:');
    console.log(`   Total businesses: ${total}`);
    console.log(`   With coordinates: ${withCoords}`);
    console.log(`   Completion: ${percentage}%`);
  }

  console.log('');
  console.log('✓ Coordinate extraction complete!');
}

// Run
main().catch(console.error);
