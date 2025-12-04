/**
 * Mobility Orchestrator Service
 * 
 * Coordinates mobility workflows:
 * - Find drivers/passengers (calls matching + ranking services)
 * - Accept match (creates mobility_trip_matches)
 * - Start trip (updates status)
 * - Complete trip (finalizes, triggers payment)
 * 
 * Port: 4600
 */

import express, { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import axios from 'axios';

// Configuration
const config = {
  port: parseInt(process.env.PORT || '4600'),
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  services: {
    matching: process.env.MATCHING_SERVICE_URL || 'http://localhost:4700',
    ranking: process.env.RANKING_SERVICE_URL || 'http://localhost:4500',
  },
  logLevel: (process.env.LOG_LEVEL || 'info') as pino.Level,
};

const logger = pino({ level: config.logLevel });

// Validation schemas
const FindDriversSchema = z.object({
  userId: z.string().uuid(),
  passengerTripId: z.string().uuid(),
  vehicleType: z.string(),
  radiusKm: z.number().optional(),
  limit: z.number().optional(),
});

const AcceptMatchSchema = z.object({
  driverTripId: z.string().uuid(),
  passengerTripId: z.string().uuid(),
  driverUserId: z.string().uuid(),
  passengerUserId: z.string().uuid(),
  estimatedFare: z.number().optional(),
});

const app = express();
app.use(express.json());
app.use(pinoHttp({ logger }));

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

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'mobility-orchestrator', 
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// POST /workflows/find-drivers - Complete workflow to find and rank drivers
app.post('/workflows/find-drivers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = FindDriversSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Invalid request', details: validation.error.errors });
      return;
    }

    const { userId, passengerTripId, vehicleType, radiusKm, limit } = validation.data;

    logger.info({ userId, passengerTripId }, 'Starting find-drivers workflow');

    // Step 1: Call matching service
    const matchingResponse = await axios.post(`${config.services.matching}/matches`, {
      tripId: passengerTripId,
      role: 'passenger',
      vehicleType,
      radiusKm,
      limit: limit || 20,
    });

    const { candidates } = matchingResponse.data;

    if (candidates.length === 0) {
      res.json({ success: true, drivers: [], count: 0, message: 'No drivers found nearby' });
      return;
    }

    // Step 2: Call ranking service
    const rankingResponse = await axios.post(`${config.services.ranking}/ranking/drivers`, {
      candidates,
      strategy: 'balanced',
      limit: limit || 9,
    });

    const { drivers } = rankingResponse.data;

    logger.info({ count: drivers.length, userId }, 'Find-drivers workflow complete');

    res.json({
      success: true,
      drivers,
      count: drivers.length,
      workflow: 'find-drivers',
    });
  } catch (error) {
    logger.error({ error }, 'Find-drivers workflow failed');
    next(error);
  }
});

// POST /workflows/accept-match - Create a trip match
app.post('/workflows/accept-match', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = AcceptMatchSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Invalid request', details: validation.error.errors });
      return;
    }

    const { driverTripId, passengerTripId, driverUserId, passengerUserId, estimatedFare } = validation.data;
    const supabase = getSupabaseClient();

    // Get trip details
    const { data: driverTrip } = await supabase
      .from('mobility_trips')
      .select('*')
      .eq('id', driverTripId)
      .single();

    const { data: passengerTrip } = await supabase
      .from('mobility_trips')
      .select('*')
      .single();

    if (!driverTrip || !passengerTrip) {
      res.status(404).json({ success: false, error: 'Trip not found' });
      return;
    }

    // Get phone numbers
    const { data: driverProfile } = await supabase
      .from('profiles')
      .select('phone_number')
      .eq('user_id', driverUserId)
      .single();

    const { data: passengerProfile } = await supabase
      .from('profiles')
      .select('phone_number')
      .eq('user_id', passengerUserId)
      .single();

    // Create match
    const { data: match, error: matchError } = await supabase
      .from('mobility_trip_matches')
      .insert({
        driver_trip_id: driverTripId,
        passenger_trip_id: passengerTripId,
        driver_user_id: driverUserId,
        passenger_user_id: passengerUserId,
        vehicle_type: driverTrip.vehicle_type,
        pickup_location: `SRID=4326;POINT(${passengerTrip.pickup_lng} ${passengerTrip.pickup_lat})`,
        dropoff_location: passengerTrip.dropoff_lat 
          ? `SRID=4326;POINT(${passengerTrip.dropoff_lng} ${passengerTrip.dropoff_lat})`
          : null,
        pickup_address: passengerTrip.pickup_text,
        dropoff_address: passengerTrip.dropoff_text,
        estimated_fare: estimatedFare,
        driver_phone: driverProfile?.phone_number || '',
        passenger_phone: passengerProfile?.phone_number || '',
        status: 'pending',
      })
      .select()
      .single();

    if (matchError) throw matchError;

    // Update trip statuses
    await supabase.from('mobility_trips').update({ status: 'matched' }).eq('id', driverTripId);
    await supabase.from('mobility_trips').update({ status: 'matched' }).eq('id', passengerTripId);

    logger.info({ matchId: match.id }, 'Match created successfully');

    res.json({
      success: true,
      match,
      workflow: 'accept-match',
    });
  } catch (error) {
    logger.error({ error }, 'Accept-match workflow failed');
    next(error);
  }
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Mobility orchestrator started');
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export { app, config };
