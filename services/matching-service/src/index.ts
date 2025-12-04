/**
 * Matching Service - Production-Grade Spatial Matching
 * 
 * Responsibilities:
 * - Find nearby trips (drivers/passengers) using PostGIS
 * - Filter by distance, vehicle type, freshness
 * - Return raw candidates (NO ranking - that's ranking-service's job)
 */

import express, { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { z } from 'zod';

// Configuration
const config = {
  port: parseInt(process.env.PORT || '4700'),
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  matching: {
    defaultRadiusKm: parseFloat(process.env.MATCHING_DEFAULT_RADIUS_KM || '15'),
    maxRadiusKm: parseFloat(process.env.MATCHING_MAX_RADIUS_KM || '50'),
    defaultLimit: parseInt(process.env.MATCHING_DEFAULT_LIMIT || '20'),
    locationFreshnessMinutes: parseInt(process.env.MATCHING_LOCATION_FRESHNESS_MINUTES || '30'),
  },
  logLevel: (process.env.LOG_LEVEL || 'info') as pino.Level,
};

// Types
export interface TripCandidate {
  trip_id: string;
  user_id: string;
  role: 'driver' | 'passenger';
  vehicle_type: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_text: string | null;
  distance_km: number;
  created_at: string;
  last_location_update: string;
  location_age_minutes: number;
}

const MatchRequestSchema = z.object({
  tripId: z.string().uuid(),
  role: z.enum(['driver', 'passenger']),
  vehicleType: z.string().optional(),
  radiusKm: z.number().min(1).max(config.matching.maxRadiusKm).optional(),
  limit: z.number().min(1).max(100).optional(),
});

const logger = pino({ level: config.logLevel });

let supabaseClient: SupabaseClient;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return supabaseClient;
}

const app = express();
app.use(express.json());
app.use(pinoHttp({ logger }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'matching-service', version: '1.0.0' });
});

app.post('/matches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = MatchRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Invalid request', details: validation.error.errors });
      return;
    }

    const { tripId, role, vehicleType, radiusKm, limit } = validation.data;
    const supabase = getSupabaseClient();

    const { data: sourceTripData, error: sourceTripError } = await supabase
      .from('mobility_trips')
      .select('pickup_lat, pickup_lng, vehicle_type, role')
      .eq('id', tripId)
      .eq('status', 'open')
      .single();

    if (sourceTripError || !sourceTripData) {
      res.json({ success: true, candidates: [], count: 0 });
      return;
    }

    const searchRole = sourceTripData.role === 'driver' ? 'passenger' : 'driver';
    const searchVehicleType = vehicleType || sourceTripData.vehicle_type;
    const searchRadiusKm = radiusKm || config.matching.defaultRadiusKm;
    const searchLimit = limit || config.matching.defaultLimit;

    const { data: candidates, error: queryError } = await supabase.rpc(
      'find_nearby_trips_v2',
      {
        p_lat: sourceTripData.pickup_lat,
        p_lng: sourceTripData.pickup_lng,
        p_role: searchRole,
        p_vehicle_type: searchVehicleType,
        p_radius_km: searchRadiusKm,
        p_limit: searchLimit,
        p_freshness_minutes: config.matching.locationFreshnessMinutes,
      }
    );

    if (queryError) throw new Error(`Failed to find matches: ${queryError.message}`);

    res.json({
      success: true,
      candidates: candidates || [],
      count: candidates?.length || 0,
      params: { tripId, role, radiusKm: searchRadiusKm, limit: searchLimit },
    });
  } catch (error) {
    next(error);
  }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Matching service started');
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export { app, config };
