#!/usr/bin/env node
/**
 * Extract lat/lng from Google Maps URLs in bars table
 * Supports formats:
 * - google.com/maps/search/?api=1&query=Name,+Lat,+Lng
 * - google.com/maps/@Lat,Lng
 * - google.com/maps/place/Name/@Lat,Lng
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lhbowpbcpwoiparwnwgt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Extract coordinates from Google Maps URL
 * @param {string} url - Google Maps URL
 * @returns {{lat: number, lng: number} | null}
 */
function extractCoordinates(url) {
  if (!url) return null;

  try {
    // Format 1: /@Lat,Lng,zoom (most common)
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return {
        lat: parseFloat(atMatch[1]),
        lng: parseFloat(atMatch[2])
      };
    }

    // Format 2: /place/Name/@Lat,Lng
    const placeMatch = url.match(/\/place\/[^@]+@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (placeMatch) {
      return {
        lat: parseFloat(placeMatch[1]),
        lng: parseFloat(placeMatch[2])
      };
    }

    // Format 3: query=Lat,Lng or query=Name,+Lat,+Lng
    const queryMatch = url.match(/query=([^&]+)/);
    if (queryMatch) {
      const decoded = decodeURIComponent(queryMatch[1]);
      const coords = decoded.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
      if (coords) {
        return {
          lat: parseFloat(coords[1]),
          lng: parseFloat(coords[2])
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`Error parsing URL: ${url}`, error.message);
    return null;
  }
}

async function updateBarCoordinates() {
  console.log('🔍 Fetching bars without coordinates...');

  // Fetch bars that have google_maps_url but no lat/lng
  const { data: bars, error } = await supabase
    .from('bars')
    .select('id, name, google_maps_url, lat, lng')
    .not('google_maps_url', 'is', null)
    .is('lat', null);

  if (error) {
    console.error('❌ Error fetching bars:', error);
    return;
  }

  console.log(`📊 Found ${bars.length} bars without coordinates`);

  let updated = 0;
  let failed = 0;

  for (const bar of bars) {
    const coords = extractCoordinates(bar.google_maps_url);

    if (coords) {
      // Validate coordinates (Rwanda is roughly between -1 to -3 lat, 28 to 31 lng)
      // Malta is roughly between 35.8 to 36.1 lat, 14.2 to 14.6 lng
      const isValid = 
        (coords.lat >= -3 && coords.lat <= -1 && coords.lng >= 28 && coords.lng <= 31) || // Rwanda
        (coords.lat >= 35.8 && coords.lat <= 36.1 && coords.lng >= 14.2 && coords.lng <= 14.6); // Malta

      if (isValid) {
        const { error: updateError } = await supabase
          .from('bars')
          .update({ 
            lat: coords.lat, 
            lng: coords.lng 
          })
          .eq('id', bar.id);

        if (updateError) {
          console.error(`❌ Failed to update ${bar.name}:`, updateError.message);
          failed++;
        } else {
          console.log(`✅ Updated ${bar.name}: ${coords.lat}, ${coords.lng}`);
          updated++;
        }
      } else {
        console.warn(`⚠️  Invalid coordinates for ${bar.name}: ${coords.lat}, ${coords.lng}`);
        failed++;
      }
    } else {
      console.warn(`⚠️  Could not extract coordinates for ${bar.name}`);
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n📈 Summary:');
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total: ${bars.length}`);
}

// Run the script
updateBarCoordinates().catch(console.error);
