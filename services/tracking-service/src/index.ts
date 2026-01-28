/**
 * Tracking Service
 * 
 * Real-time location updates and trip progress tracking
 * Port: 4800
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import express, { NextFunction,Request, Response } from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { z } from 'zod';

const config = {
  port: parseInt(process.env.PORT || '4800'),
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
};

const logger = pino({ level: 'info' });

const LocationUpdateSchema = z.object({
  tripId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  timestamp: z.string().optional(),
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

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'tracking-service', version: '1.0.0' });
});

// POST /locations/update - Update trip location
app.post('/locations/update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = LocationUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: 'Invalid request', details: validation.error.errors });
      return;
    }

    const { tripId, lat, lng, timestamp } = validation.data;
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('mobility_trips')
      .update({
        pickup_lat: lat,
        pickup_lng: lng,
        last_location_update: timestamp || new Date().toISOString(),
      })
      .eq('id', tripId);

    if (error) throw error;

    res.json({ success: true, tripId, lat, lng, updated_at: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// GET /trips/:id/progress - Get trip progress
app.get('/trips/:id/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const supabase = getSupabaseClient();

    const { data: match } = await supabase
      .from('mobility_trip_matches')
      .select('*')
      .eq('id', id)
      .single();

    if (!match) {
      res.status(404).json({ success: false, error: 'Trip not found' });
      return;
    }

    res.json({
      success: true,
      trip: {
        id: match.id,
        status: match.status,
        created_at: match.created_at,
        accepted_at: match.accepted_at,
        started_at: match.started_at,
        completed_at: match.completed_at,
      },
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
  logger.info({ port: config.port }, 'Tracking service started');
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export { app };
