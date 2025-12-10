/**
 * Location Message Handler for Jobs Service
 * 
 * Handles WhatsApp location messages and integrates with:
 * - 30-minute location cache
 * - Saved locations (home/work)
 * - GPS-based job search
 * 
 * Now powered by unified LocationService!
 * 
 * @module location-handler
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import type { WhatsAppMessage } from "../../_shared/wa-webhook-shared/types.ts";
import { t } from "../utils/i18n.ts";
import { LocationService } from "../../_shared/location/index.ts";

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

/**
 * Parse WhatsApp location message
 */
export function parseWhatsAppLocation(locationObj: any): LocationData | null {
  if (!locationObj || typeof locationObj !== 'object') {
    return null;
  }

  const lat = Number(locationObj.latitude);
  const lng = Number(locationObj.longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return {
    lat,
    lng,
    address: locationObj.address || undefined,
    name: locationObj.name || undefined,
  };
}

/**
 * Handle location message for jobs service
 * 
 * Flow:
 * 1. Parse location from WhatsApp message
 * 2. Save to 30-minute cache
 * 3. Search nearby jobs
 * 4. Send results to user
 */
export async function handleLocationMessage(
  supabase: SupabaseClient,
  message: WhatsAppMessage,
  userId: string,
  locale: string,
  correlationId: string,
): Promise<boolean> {
  
  const phone = message.from;
  
  // Parse location
  const location = parseWhatsAppLocation((message as any).location);
  
  if (!location) {
    logStructuredEvent("JOBS_LOCATION_PARSE_FAILED", {
      correlationId,
      from: maskPhone(phone),
    }, "warn");
    
    await sendText(phone, t(locale, "jobs.location.invalid"));
    return false;
  }

  logStructuredEvent("JOBS_LOCATION_RECEIVED", {
    correlationId,
    from: maskPhone(phone),
    hasAddress: !!location.address,
  });

  // Save to cache (30-minute TTL) using unified LocationService
  try {
    const result = await LocationService.save(
      supabase,
      userId,
      { lat: location.lat, lng: location.lng },
      'jobs',
      { action: 'job_search' },
      30,  // 30-minute TTL
    );

    if (result) {
      logStructuredEvent("JOBS_LOCATION_CACHED", {
        correlationId,
        ttl_minutes: 30,
      });
    } else {
      logStructuredEvent("JOBS_LOCATION_CACHE_FAILED", {
        correlationId,
        error: "LocationService.save returned null",
      }, "warn");
    }
  } catch (err) {
    logStructuredEvent("JOBS_LOCATION_CACHE_ERROR", {
      correlationId,
      error: String(err),
    }, "error");
  }

  // Search nearby jobs
  await searchAndSendNearbyJobs(
    supabase,
    phone,
    location.lat,
    location.lng,
    locale,
    correlationId,
  );

  return true;
}

/**
 * Search for nearby jobs and send results to user
 */
export async function searchAndSendNearbyJobs(
  supabase: SupabaseClient,
  phone: string,
  lat: number,
  lng: number,
  locale: string,
  correlationId: string,
  radiusKm: number = 50,
): Promise<void> {
  
  try {
    // Call nearby jobs RPC function
    const { data: jobs, error } = await supabase.rpc("search_nearby_jobs", {
      _lat: lat,
      _lng: lng,
      _radius_km: radiusKm,
      _limit: 10,
    });

    if (error) {
      throw error;
    }

    logStructuredEvent("JOBS_NEARBY_SEARCH", {
      correlationId,
      radiusKm,
      resultsCount: jobs?.length || 0,
    });

    if (!jobs || jobs.length === 0) {
      await sendText(
        phone,
        t(locale, "jobs.location.noResults", { radius: String(radiusKm) })
      );
      
      // Offer to expand search
      await sendText(
        phone,
        t(locale, "jobs.location.expandSearch")
      );
      return;
    }

    // Format and send results
    let message = t(locale, "jobs.location.resultsHeader", { 
      count: String(jobs.length), 
      radius: String(radiusKm)
    }) + "\n\n";

    jobs.forEach((job: any, i: number) => {
      const distanceStr = job.distance_km 
        ? `📍 ${job.distance_km}km away` 
        : '📍 Distance unknown';
      
      const payStr = job.pay_min && job.pay_max
        ? `💰 ${job.currency || 'RWF'} ${job.pay_min}-${job.pay_max}`
        : '💰 Negotiable';

      message += `*${i + 1}. ${job.title}*\n`;
      
      if (job.company) {
        message += `   🏢 ${job.company}\n`;
      }
      
      message += `   ${distanceStr}\n`;
      message += `   ${payStr}\n`;
      
      if (job.job_type) {
        message += `   ⏰ ${job.job_type}\n`;
      }
      
      message += `\n`;
    });

    message += t(locale, "jobs.location.footer");

    await sendText(phone, message);

    logStructuredEvent("JOBS_NEARBY_RESULTS_SENT", {
      correlationId,
      jobCount: jobs.length,
    });

  } catch (error) {
    logStructuredEvent("JOBS_NEARBY_SEARCH_ERROR", {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    await sendText(phone, t(locale, "jobs.location.searchError"));
  }
}

/**
 * Get user location from cache or saved locations
 * Returns null if no location available
 * 
 * Now powered by unified LocationService!
 */
export async function getUserLocation(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ lat: number; lng: number; source: string } | null> {
  
  // Use unified LocationService
  const result = await LocationService.resolve(
    supabase,
    userId,
    {
      source: 'jobs',
      cacheTTLMinutes: 30,
      preferredSavedLabel: 'home',  // Jobs typically use home location
    },
    'en',
  );

  if (!result.location) {
    return null;
  }

  return {
    lat: result.location.lat,
    lng: result.location.lng,
    source: result.source || 'unknown',
  };
}

/**
 * Prompt user to share location
 */
export async function promptForLocation(
  phone: string,
  locale: string,
  context: 'job_search' | 'job_post' = 'job_search',
): Promise<void> {
  const key = context === 'job_search' 
    ? 'jobs.location.promptSearch'
    : 'jobs.location.promptPost';
    
  await sendText(phone, t(locale, key));
}

/**
 * Mask phone for logging (privacy)
 */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return "***";
  return phone.slice(0, 4) + "***" + phone.slice(-3);
}
