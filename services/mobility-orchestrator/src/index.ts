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
import axios, { AxiosInstance } from 'axios';
import { getCachedMatches, cacheMatches } from '@easymo/cache-layer/cache';

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
  tables: {
    trips: process.env.MOBILITY_TRIPS_TABLE || 'trips',
  },
  logLevel: (process.env.LOG_LEVEL || 'info') as pino.Level,
};

const logger = pino({ level: config.logLevel });
const http: AxiosInstance = axios.create({
  timeout: parseInt(process.env.HTTP_TIMEOUT_MS || '5000'),
});

async function postWithRetry<T>(
  url: string,
  payload: unknown,
  retries = 1
): Promise<T> {
  let attempt = 0;
  // basic bounded retry with small backoff to avoid long hangs on dependencies
  while (true) {
    try {
      const response = await http.post<T>(url, payload);
      return response.data;
    } catch (err) {
      attempt += 1;
      const isLast = attempt > retries;
      logger.warn(
        { url, attempt, error: err instanceof Error ? err.message : String(err) },
        'Downstream request failed'
      );
      if (isLast) throw err;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
}

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

    // Check cache first
    const cacheKey = `${passengerTripId}:${vehicleType}:${radiusKm || 15}`;
    const cachedResult = await getCachedMatches(cacheKey);

    if (cachedResult) {
      logger.info({ tripId: passengerTripId }, 'Cache hit for matches');
      res.json({
        success: true,
        drivers: cachedResult,
        count: cachedResult.length,
        workflow: 'find-drivers',
        cached: true,
      });
      return;
    }

    // Step 1: Call matching service
    const matchingResponse = await postWithRetry<{ candidates: unknown[] }>(
      `${config.services.matching}/matches`,
      {
        tripId: passengerTripId,
        role: 'passenger',
        vehicleType,
        radiusKm,
        limit: limit || 20,
      },
      2
    );

    const { candidates } = matchingResponse;

    if (candidates.length === 0) {
      res.json({ success: true, drivers: [], count: 0, message: 'No drivers found nearby' });
      return;
    }

    // Step 2: Call ranking service
    const rankingResponse = await postWithRetry<{ drivers: unknown[] }>(
      `${config.services.ranking}/ranking/drivers`,
      {
        candidates,
        strategy: 'balanced',
        limit: limit || 9,
      },
      1
    );

    const { drivers } = rankingResponse;

    // Cache the result
    await cacheMatches(cacheKey, drivers);

    logger.info({ count: drivers.length, userId }, 'Find-drivers workflow complete');

    res.json({
      success: true,
      drivers,
      count: drivers.length,
      workflow: 'find-drivers',
      cached: false,
    });
  } catch (error) {
    logger.error({ error }, 'Find-drivers workflow failed');
    next(error);
  }
});

// POST /workflows/accept-match - Create a trip match
// NOTE: This service does not auto-match. It only returns contact + trip details
// so users can contact each other directly on WhatsApp.
app.post('/workflows/accept-match', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = AcceptMatchSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Invalid request', details: validation.error.errors });
      return;
    }

    const { driverTripId, passengerTripId, driverUserId, passengerUserId } = validation.data;
    const supabase = getSupabaseClient();

    // Get trip details
    const { data: driverTrip } = await supabase
      .from(config.tables.trips)
      .select('*')
      .eq('id', driverTripId)
      .single();

    const { data: passengerTrip } = await supabase
      .from(config.tables.trips)
      .select('*')
      .eq('id', passengerTripId)
      .single();

    if (!driverTrip || !passengerTrip) {
      res.status(404).json({ success: false, error: 'Trip not found' });
      return;
    }

    // Get phone numbers
    const { data: driverProfile } = await supabase
      .from('profiles')
      .select('whatsapp_e164, wa_id')
      .eq('user_id', driverUserId)
      .single();

    const { data: passengerProfile } = await supabase
      .from('profiles')
      .select('whatsapp_e164, wa_id, display_name')
      .eq('user_id', passengerUserId)
      .single();

    const driverContact = {
      userId: driverUserId,
      whatsapp: driverProfile?.whatsapp_e164 || driverProfile?.wa_id || '',
      waId: driverProfile?.wa_id || null,
      displayName: (driverProfile as any)?.display_name || null,
    };
    const passengerContact = {
      userId: passengerUserId,
      whatsapp: passengerProfile?.whatsapp_e164 || passengerProfile?.wa_id || '',
      waId: passengerProfile?.wa_id || null,
      displayName: (passengerProfile as any)?.display_name || null,
    };

    logger.info(
      { driverTripId, passengerTripId, driverUserId, passengerUserId },
      'Returning contact info for manual selection'
    );

    res.json({
      success: true,
      workflow: 'accept-match',
      driverTrip,
      passengerTrip,
      contacts: {
        driver: driverContact,
        passenger: passengerContact,
      },
      note: 'No automatic booking performed; user must contact manually.',
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
