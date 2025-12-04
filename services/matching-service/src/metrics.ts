/**
 * Prometheus Metrics for Mobility Services
 * 
 * Exposes metrics for:
 * - HTTP request duration
 * - Request count by status
 * - Service health
 * - Cache hit/miss rates
 * - Database query duration
 */

import promClient from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Create a Registry
export const register = new promClient.Registry();

// Default metrics (CPU, memory, etc)
promClient.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const cacheHitTotal = new promClient.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheMissTotal = new promClient.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});

export const matchingDuration = new promClient.Histogram({
  name: 'matching_duration_seconds',
  help: 'Duration of matching operations',
  labelNames: ['vehicle_type'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1],
  registers: [register],
});

export const rankingDuration = new promClient.Histogram({
  name: 'ranking_duration_seconds',
  help: 'Duration of ranking operations',
  labelNames: ['strategy'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5],
  registers: [register],
});

export const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  registers: [register],
});

export const tripMatchesCreated = new promClient.Counter({
  name: 'trip_matches_created_total',
  help: 'Total number of trip matches created',
  labelNames: ['vehicle_type'],
  registers: [register],
});

export const driversFound = new promClient.Histogram({
  name: 'drivers_found',
  help: 'Number of drivers found per search',
  labelNames: ['vehicle_type'],
  buckets: [0, 1, 5, 10, 20, 50],
  registers: [register],
});

// Middleware to track HTTP metrics
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;

    httpRequestDuration.labels(req.method, route, String(res.statusCode)).observe(duration);
    httpRequestTotal.labels(req.method, route, String(res.statusCode)).inc();
  });

  next();
}

// Helper functions
export function recordCacheHit(cacheType: string) {
  cacheHitTotal.labels(cacheType).inc();
}

export function recordCacheMiss(cacheType: string) {
  cacheMissTotal.labels(cacheType).inc();
}

export function recordMatchingDuration(vehicleType: string, duration: number) {
  matchingDuration.labels(vehicleType).observe(duration);
}

export function recordRankingDuration(strategy: string, duration: number) {
  rankingDuration.labels(strategy).observe(duration);
}

export function recordDatabaseQuery(operation: string, table: string, duration: number) {
  databaseQueryDuration.labels(operation, table).observe(duration);
}

export function recordTripMatch(vehicleType: string) {
  tripMatchesCreated.labels(vehicleType).inc();
}

export function recordDriversFound(vehicleType: string, count: number) {
  driversFound.labels(vehicleType).observe(count);
}
