/**
 * Mobility Driver Ranking
 * 
 * Extends ranking-service to score mobility drivers based on:
 * - Rating (40%)
 * - Acceptance rate (30%)
 * - Completion rate (30%)
 * - Distance (bonus: closer = better)
 * - Recency (bonus: recent activity = better)
 */

import { PrismaClient } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface DriverCandidate {
  trip_id: string;
  user_id: string;
  vehicle_type: string;
  distance_km: number;
  location_age_minutes: number;
  created_at: string;
}

export interface RankedDriver extends DriverCandidate {
  score: number;
  rank: number;
  metrics: {
    rating: number | null;
    acceptance_rate: number;
    completion_rate: number;
    total_trips: number;
  };
}

export interface RankDriversOptions {
  candidates: DriverCandidate[];
  strategy?: 'balanced' | 'quality' | 'proximity';
  limit?: number;
}

export interface RankDriversResult {
  drivers: RankedDriver[];
  count: number;
  strategy: string;
}

/**
 * Scoring weights by strategy
 */
const STRATEGIES = {
  balanced: {
    rating: 0.4,
    acceptance: 0.3,
    completion: 0.3,
    distance: 0.0,  // Not used in base score
    recency: 0.0,   // Not used in base score
  },
  quality: {
    rating: 0.5,
    acceptance: 0.3,
    completion: 0.2,
    distance: 0.0,
    recency: 0.0,
  },
  proximity: {
    rating: 0.2,
    acceptance: 0.2,
    completion: 0.1,
    distance: 0.3,
    recency: 0.2,
  },
};

/**
 * Fetch driver metrics from database
 */
async function fetchDriverMetrics(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, any>> {
  const { data, error } = await supabase
    .from('mobility_driver_metrics')
    .select('*')
    .in('user_id', userIds);

  if (error) {
    console.error('Failed to fetch driver metrics:', error);
    return new Map();
  }

  return new Map((data || []).map(m => [m.user_id, m]));
}

/**
 * Calculate base score (0-1) for a driver
 */
function calculateBaseScore(
  metrics: any,
  weights: typeof STRATEGIES.balanced
): number {
  if (!metrics) {
    // New driver with no history: default score
    return 0.5;
  }

  const rating = metrics.avg_rating ? metrics.avg_rating / 5.0 : 0.6;
  const acceptance = metrics.acceptance_rate ? metrics.acceptance_rate / 100.0 : 1.0;
  const completion = metrics.total_trips > 0
    ? (metrics.completed_trips / metrics.total_trips)
    : 0.8;

  return (
    rating * weights.rating +
    acceptance * weights.acceptance +
    completion * weights.completion
  );
}

/**
 * Calculate distance bonus (closer = better)
 * 0-2km: +0.2
 * 2-5km: +0.1
 * 5-10km: +0.05
 * 10km+: +0.0
 */
function calculateDistanceBonus(distanceKm: number): number {
  if (distanceKm <= 2) return 0.2;
  if (distanceKm <= 5) return 0.1;
  if (distanceKm <= 10) return 0.05;
  return 0.0;
}

/**
 * Calculate recency bonus (recent activity = better)
 * < 5 min: +0.15
 * 5-15 min: +0.1
 * 15-30 min: +0.05
 * 30min+: +0.0
 */
function calculateRecencyBonus(locationAgeMinutes: number): number {
  if (locationAgeMinutes < 5) return 0.15;
  if (locationAgeMinutes < 15) return 0.1;
  if (locationAgeMinutes < 30) return 0.05;
  return 0.0;
}

/**
 * Rank drivers by score
 */
export async function rankDrivers(
  supabase: SupabaseClient,
  options: RankDriversOptions
): Promise<RankDriversResult> {
  const { candidates, strategy = 'balanced', limit } = options;

  if (candidates.length === 0) {
    return { drivers: [], count: 0, strategy };
  }

  // 1. Fetch metrics for all candidates
  const userIds = candidates.map(c => c.user_id);
  const metricsMap = await fetchDriverMetrics(supabase, userIds);
  const weights = STRATEGIES[strategy];

  // 2. Score each candidate
  const scoredDrivers = candidates.map(candidate => {
    const metrics = metricsMap.get(candidate.user_id);

    // Base score (quality metrics)
    const baseScore = calculateBaseScore(metrics, weights);

    // Bonuses (proximity + recency)
    const distanceBonus = calculateDistanceBonus(candidate.distance_km);
    const recencyBonus = calculateRecencyBonus(candidate.location_age_minutes);

    // Final score (capped at 1.0)
    const finalScore = Math.min(1.0, baseScore + distanceBonus + recencyBonus);

    return {
      ...candidate,
      score: Number(finalScore.toFixed(4)),
      rank: 0, // Will be set after sorting
      metrics: {
        rating: metrics?.avg_rating || null,
        acceptance_rate: metrics?.acceptance_rate || 100,
        completion_rate: metrics?.total_trips > 0
          ? Number(((metrics.completed_trips / metrics.total_trips) * 100).toFixed(1))
          : 80,
        total_trips: metrics?.total_trips || 0,
      },
    };
  });

  // 3. Sort by score (descending)
  scoredDrivers.sort((a, b) => b.score - a.score);

  // 4. Assign ranks
  scoredDrivers.forEach((driver, index) => {
    driver.rank = index + 1;
  });

  // 5. Apply limit
  const topDrivers = limit ? scoredDrivers.slice(0, limit) : scoredDrivers;

  return {
    drivers: topDrivers,
    count: topDrivers.length,
    strategy,
  };
}

/**
 * Get recommended drivers for a user based on their history
 * (Future enhancement - not implemented yet)
 */
export async function getRecommendedDrivers(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 5
): Promise<DriverCandidate[]> {
  // This would query mobility_intents to find drivers
  // that frequently operate in user's common areas
  // For now, return empty array
  return [];
}
