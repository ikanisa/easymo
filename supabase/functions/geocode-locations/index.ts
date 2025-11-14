/**
 * Supabase Edge Function: geocode-locations
 * 
 * Geocodes bars and businesses using Google Maps Geocoding API
 * Can be triggered manually or via scheduled cron job
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface GeocodeRequest {
  table?: 'bars' | 'business' | 'all'
  batch_size?: number
  force?: boolean
}

interface GeocodeResult {
  latitude: number
  longitude: number
  formatted_address: string
}

async function geocodeAddress(
  address: string,
  country?: string
): Promise<GeocodeResult | null> {
  try {
    const fullAddress = country ? `${address}, ${country}` : address
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      fullAddress
    )}&key=${GOOGLE_MAPS_API_KEY}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0]
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formatted_address: result.formatted_address,
      }
    }

    console.warn(`Geocoding failed for "${fullAddress}": ${data.status}`)
    return null
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}

async function geocodeBars(
  supabase: any,
  batchSize: number,
  force: boolean
): Promise<{ success: number; failed: number; skipped: number }> {
  let success = 0, failed = 0, skipped = 0

  const query = supabase
    .from('bars')
    .select('id, name, location_text, country, city_area, latitude, longitude, geocode_status')
    .limit(batchSize)

  if (!force) {
    query.in('geocode_status', ['pending', 'failed'])
  }

  const { data: bars, error } = await query
  if (error) throw error

  for (const bar of bars || []) {
    if (!force && bar.latitude && bar.longitude && bar.geocode_status === 'success') {
      skipped++
      continue
    }

    let address = bar.location_text || bar.name
    let result = await geocodeAddress(address, bar.country)

    if (!result && bar.city_area) {
      address = `${bar.name}, ${bar.city_area}, ${bar.country}`
      result = await geocodeAddress(address)
    }

    if (result) {
      await supabase
        .from('bars')
        .update({
          latitude: result.latitude,
          longitude: result.longitude,
          geocode_status: 'success',
          geocoded_at: new Date().toISOString(),
        })
        .eq('id', bar.id)
      success++
    } else {
      await supabase
        .from('bars')
        .update({ geocode_status: 'failed', geocoded_at: new Date().toISOString() })
        .eq('id', bar.id)
      failed++
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return { success, failed, skipped }
}

async function geocodeBusiness(
  supabase: any,
  batchSize: number,
  force: boolean
): Promise<{ success: number; failed: number; skipped: number }> {
  let success = 0, failed = 0, skipped = 0

  const query = supabase
    .from('business')
    .select('id, name, location_text, country, latitude, longitude, geocode_status')
    .limit(batchSize)

  if (!force) {
    query.in('geocode_status', ['pending', 'failed'])
  }

  const { data: businesses, error } = await query
  if (error) throw error

  for (const business of businesses || []) {
    if (!force && business.latitude && business.longitude && business.geocode_status === 'success') {
      skipped++
      continue
    }

    const address = business.location_text || business.name
    const result = await geocodeAddress(address, business.country)

    if (result) {
      await supabase
        .from('business')
        .update({
          latitude: result.latitude,
          longitude: result.longitude,
          geocode_status: 'success',
          geocoded_at: new Date().toISOString(),
        })
        .eq('id', business.id)
      success++
    } else {
      await supabase
        .from('business')
        .update({ geocode_status: 'failed', geocoded_at: new Date().toISOString() })
        .eq('id', business.id)
      failed++
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return { success, failed, skipped }
}

serve(async (req) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json().catch(() => ({}))
    const table = body.table || 'all'
    const batchSize = body.batch_size || 50
    const force = body.force || false

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    let results = {
      bars: { success: 0, failed: 0, skipped: 0 },
      business: { success: 0, failed: 0, skipped: 0 },
    }

    if (table === 'bars' || table === 'all') {
      results.bars = await geocodeBars(supabase, batchSize, force)
    }

    if (table === 'business' || table === 'all') {
      results.business = await geocodeBusiness(supabase, batchSize, force)
    }

    const total = {
      success: results.bars.success + results.business.success,
      failed: results.bars.failed + results.business.failed,
      skipped: results.bars.skipped + results.business.skipped,
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Geocoding complete: ${total.success} successful, ${total.failed} failed, ${total.skipped} skipped`,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
