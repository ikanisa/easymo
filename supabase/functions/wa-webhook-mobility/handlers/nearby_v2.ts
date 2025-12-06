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

import { logStructuredEvent } from '../../_shared/observability.ts';

const ORCHESTRATOR_URL = Deno.env.get('MOBILITY_ORCHESTRATOR_URL') || 'http://localhost:4600';

/**
 * @deprecated Use handleNearbyLocation from nearby.ts instead
 */
export async function handleNearbyRequest(_payload: unknown): Promise<{ success: boolean; driversFound?: number; error?: string }> {
  await logStructuredEvent('NEARBY_V2_DEPRECATED_CALL', {
    message: 'nearby_v2.ts is deprecated. Calls should use nearby.ts instead.',
  }, 'warn');
  
  return {
    success: false,
    error: 'This handler is deprecated. Use nearby.ts instead.',
  };
}

/**
 * @deprecated Use handleNearbyResultSelection from nearby.ts instead
 */
export async function handleDriverSelection(_payload: unknown): Promise<{ success: boolean; matchId?: string; error?: string }> {
  await logStructuredEvent('NEARBY_V2_DEPRECATED_CALL', {
    message: 'nearby_v2.ts is deprecated. Calls should use nearby.ts instead.',
  }, 'warn');
  
  return {
    success: false,
    error: 'This handler is deprecated. Use nearby.ts instead.',
  };
}
