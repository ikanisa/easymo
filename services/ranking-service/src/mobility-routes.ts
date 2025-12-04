import express, { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { rankDrivers, DriverCandidate } from './mobility-ranking';

const router = express.Router();

// Validation schema
const RankDriversRequestSchema = z.object({
  candidates: z.array(z.object({
    trip_id: z.string().uuid(),
    user_id: z.string().uuid(),
    vehicle_type: z.string(),
    distance_km: z.number(),
    location_age_minutes: z.number(),
    created_at: z.string(),
  })),
  strategy: z.enum(['balanced', 'quality', 'proximity']).optional(),
  limit: z.number().min(1).max(100).optional(),
});

/**
 * POST /ranking/drivers
 * 
 * Rank driver candidates by quality + proximity
 */
router.post('/drivers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const validation = RankDriversRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors,
      });
      return;
    }

    const { candidates, strategy, limit } = validation.data;

    // Get Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Rank drivers
    const result = await rankDrivers(supabase, { candidates, strategy, limit });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ranking/drivers/health
 * 
 * Health check for mobility ranking
 */
router.get('/drivers/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'ranking-service',
    feature: 'mobility-drivers',
    timestamp: new Date().toISOString(),
  });
});

export default router;
