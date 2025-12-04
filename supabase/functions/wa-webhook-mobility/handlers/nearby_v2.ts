/**
 * Nearby Handler - Thin Controller (V2)
 * 
 * Refactored from 1121-line monolith to clean orchestrator pattern.
 * 
 * Responsibilities:
 * - Parse WhatsApp messages
 * - Route to mobility-orchestrator service
 * - Format responses for WhatsApp
 * 
 * Does NOT:
 * - Perform matching (delegates to matching-service)
 * - Perform ranking (delegates to ranking-service)
 * - Perform database writes (delegates to orchestrator)
 */

import { sendMessage } from '../utils/reply.ts';
import { logStructuredEvent } from '../_shared/observability.ts';

const ORCHESTRATOR_URL = Deno.env.get('MOBILITY_ORCHESTRATOR_URL') || 'http://localhost:4600';

interface FindDriversRequest {
  from: string;
  userId: string;
  passengerTripId: string;
  vehicleType: string;
  radiusKm?: number;
}

export async function handleNearbyRequest(payload: FindDriversRequest) {
  const { from, userId, passengerTripId, vehicleType, radiusKm } = payload;

  try {
    await logStructuredEvent('MOBILITY_FIND_DRIVERS_START', {
      userId,
      passengerTripId,
      vehicleType,
    });

    // Call orchestrator service
    const response = await fetch(`${ORCHESTRATOR_URL}/workflows/find-drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        passengerTripId,
        vehicleType,
        radiusKm: radiusKm || 15,
        limit: 9,
      }),
    });

    if (!response.ok) {
      throw new Error(`Orchestrator error: ${response.statusText}`);
    }

    const result = await response.json();

    // Format response for WhatsApp
    if (result.count === 0) {
      await sendMessage(from, {
        type: 'text',
        text: {
          body: '❌ No drivers found nearby. Please try again later or expand your search radius.',
        },
      });

      await logStructuredEvent('MOBILITY_NO_DRIVERS_FOUND', { userId, passengerTripId });
      return { success: true, driversFound: 0 };
    }

    // Build interactive list of drivers
    const driversList = result.drivers.slice(0, 9).map((driver: any, index: number) => {
      const distance = driver.distance_km.toFixed(1);
      const rating = driver.metrics.rating ? `⭐ ${driver.metrics.rating.toFixed(1)}` : '⭐ New';
      const trips = driver.metrics.total_trips;

      return {
        id: driver.trip_id,
        title: `Driver ${index + 1}`,
        description: `${distance}km away • ${rating} • ${trips} trips`,
      };
    });

    await sendMessage(from, {
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: `🏍️ Found ${result.count} drivers`,
        },
        body: {
          text: `Select a driver to request a ride. All drivers are nearby and available.`,
        },
        action: {
          button: 'Select Driver',
          sections: [
            {
              title: 'Available Drivers',
              rows: driversList,
            },
          ],
        },
      },
    });

    await logStructuredEvent('MOBILITY_DRIVERS_LISTED', {
      userId,
      passengerTripId,
      driversFound: result.count,
    });

    return { success: true, driversFound: result.count };
  } catch (error) {
    console.error('handleNearbyRequest error:', error);

    await sendMessage(from, {
      type: 'text',
      text: {
        body: '⚠️ Error finding drivers. Please try again.',
      },
    });

    await logStructuredEvent('MOBILITY_FIND_DRIVERS_ERROR', {
      userId,
      error: error.message,
    });

    return { success: false, error: error.message };
  }
}

/**
 * Handle driver selection (passenger chose a driver from list)
 */
export async function handleDriverSelection(payload: {
  from: string;
  userId: string;
  passengerTripId: string;
  driverTripId: string;
}) {
  const { from, userId, passengerTripId, driverTripId } = payload;

  try {
    // Get driver user ID from trip
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: driverTrip } = await supabase
      .from('mobility_trips')
      .select('creator_user_id')
      .eq('id', driverTripId)
      .single();

    if (!driverTrip) {
      throw new Error('Driver trip not found');
    }

    // Call orchestrator to create match
    const response = await fetch(`${ORCHESTRATOR_URL}/workflows/accept-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverTripId,
        passengerTripId,
        driverUserId: driverTrip.creator_user_id,
        passengerUserId: userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Orchestrator error: ${response.statusText}`);
    }

    const result = await response.json();

    await sendMessage(from, {
      type: 'text',
      text: {
        body: `✅ Match request sent! The driver will be notified. You'll receive confirmation once accepted.`,
      },
    });

    await logStructuredEvent('MOBILITY_MATCH_CREATED', {
      userId,
      matchId: result.match.id,
      passengerTripId,
      driverTripId,
    });

    return { success: true, matchId: result.match.id };
  } catch (error) {
    console.error('handleDriverSelection error:', error);

    await sendMessage(from, {
      type: 'text',
      text: {
        body: '⚠️ Error creating match. Please try again.',
      },
    });

    return { success: false, error: error.message };
  }
}
