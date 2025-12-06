/**
 * Nearby Handler - Thin Controller (V2)
 * 
 * @deprecated This file is DEPRECATED. Use handlers/nearby.ts instead.
 * 
 * This was a refactored version designed to delegate to an external orchestrator,
 * but the orchestrator service (MOBILITY_ORCHESTRATOR_URL) was never deployed.
 * 
 * The main nearby.ts handler handles all mobility matching directly via SQL functions.
 * 
 * DO NOT USE THIS FILE. It will be removed in a future cleanup.
 */

// deno-lint-ignore-file no-unused-vars

/**
 * @deprecated Use handleNearbyLocation from nearby.ts instead
 */
export async function handleNearbyRequest(_payload: unknown): Promise<{ success: boolean; driversFound?: number; error?: string }> {
  console.warn('[DEPRECATED] nearby_v2.ts::handleNearbyRequest called - use nearby.ts instead');
  
  return {
    success: false,
    error: 'This handler is deprecated. Use nearby.ts instead.',
  };
}

/**
 * @deprecated Use handleNearbyResultSelection from nearby.ts instead
 */
export async function handleDriverSelection(_payload: unknown): Promise<{ success: boolean; matchId?: string; error?: string }> {
  console.warn('[DEPRECATED] nearby_v2.ts::handleDriverSelection called - use nearby.ts instead');
  
  return {
    success: false,
    error: 'This handler is deprecated. Use nearby.ts instead.',
  };
}
