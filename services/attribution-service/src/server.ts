import {
  type AttributionServiceRouteKey,
  createHealthCheck,
  createMetricsRegistry,
  createRateLimiter,
  expressRequestContext,
  expressServiceAuth,
  getAttributionServiceRoutePath,
  getAttributionServiceRouteRequiredScopes,
  metricsHandler,
  metricsMiddleware,
} from "@easymo/commons";
import { PrismaService } from "@easymo/db";
import express, { type Express, type RequestHandler } from "express";
import pinoHttp from "pino-http";
import { z } from "zod";

import { settings } from "./config";
import { evaluateAttribution } from "./evaluator";
import { logger } from "./logger";

import { childLogger } from '@easymo/commons';

const log = childLogger({ service: 'attribution-service' });

const prisma = new PrismaService();

// Initialize metrics registry
const metrics = createMetricsRegistry('attribution-service');

// Create health check with database verification
const healthCheck = createHealthCheck({
  version: process.env.npm_package_version || '1.0.0',
  database: async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      log.error({ error }, 'Database health check failed');
      return false;
    }
  },
});

export function buildApp(deps: { prisma: PrismaService }): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(expressRequestContext({ generateIfMissing: true }));
  app.use(pinoHttp({ logger: logger as any }));
  
  // Add metrics middleware to track all HTTP requests
  app.use(metricsMiddleware(metrics));

  if (settings.rateLimit.redisUrl) {
    app.use(
      createRateLimiter({
        redisUrl: settings.rateLimit.redisUrl,
        points: settings.rateLimit.points,
        durationSeconds: settings.rateLimit.windowSeconds,
        keyPrefix: "attribution-service",
        logger,
      }),
    );
  }

  const requireAuthForRoute = (route: AttributionServiceRouteKey): RequestHandler => {
    const scopes = getAttributionServiceRouteRequiredScopes(route);
    if (scopes.length === 0) {
      return (_req, _res, next) => next();
    }
    return expressServiceAuth({ audience: settings.auth.audience, requiredScopes: [...scopes] });
  };

  const EvaluateSchema = z.object({
    quoteId: z.string().uuid().optional(),
    timeboxDays: z.coerce.number().default(7),
    referrals: z.array(z.any()).optional(),
    events: z.array(z.any()).optional(),
    persist: z.boolean().default(true),
  });

  app.post(
    getAttributionServiceRoutePath("evaluate"),
    requireAuthForRoute("evaluate"),
    async (req, res) => {
      try {
        const payload = EvaluateSchema.parse(req.body);

        // Measure business operation
        const { type, entityId } = await metrics.measureDuration('evaluate.attribution', async () => {
          return evaluateAttribution({
            referrals: payload.referrals,
            events: payload.events,
            timeboxDays: payload.timeboxDays,
          });
        });

        if (payload.persist && payload.quoteId) {
          await metrics.measureDuration('persist.attribution', async () => {
            await deps.prisma.quote.update({
              where: { id: payload.quoteId },
              data: {
                attributionType: type.toLowerCase() as any,
                attributionEntityId: entityId,
              },
            });
          });
        }

        res.json({ attribution: { type, entityId, evaluatedAt: new Date().toISOString() } });
      } catch (error) {
        logger.error({ msg: "attribution.evaluate.error", error });
        res.status(400).json({ error: (error as Error).message });
      }
    },
  );

  const EvidenceSchema = z.object({
    quoteId: z.string().uuid(),
    artifacts: z.array(z.object({ kind: z.string(), ref: z.string().optional(), data: z.any().optional() })),
  });

  app.post(
    getAttributionServiceRoutePath("evidence"),
    requireAuthForRoute("evidence"),
    async (req, res) => {
      try {
        const payload = EvidenceSchema.parse(req.body);
        const created = await deps.prisma.attributionEvidence.create({
          data: {
            quoteId: payload.quoteId,
            artifacts: payload.artifacts as any,
          },
        });
        res.status(202).json({ stored: true, id: created.id, count: payload.artifacts.length });
      } catch (error) {
        logger.error({ msg: "attribution.evidence.error", error });
        res.status(400).json({ error: (error as Error).message });
      }
    },
  );

  const DisputeSchema = z.object({
    quoteId: z.string().uuid(),
    reason: z.string(),
    actor: z.string(),
  });

  app.post(
    getAttributionServiceRoutePath("disputes"),
    requireAuthForRoute("disputes"),
    async (req, res) => {
      try {
        const payload = DisputeSchema.parse(req.body);
        const dispute = await deps.prisma.dispute.create({
          data: {
            quoteId: payload.quoteId,
            reason: payload.reason,
            actor: payload.actor,
          },
        });
        res.status(202).json({ disputeId: dispute.id, ...payload });
      } catch (error) {
        logger.error({ msg: "attribution.dispute.error", error });
        res.status(400).json({ error: (error as Error).message });
      }
    },
  );

  // Enhanced health endpoint with dependency checks
  app.get(getAttributionServiceRoutePath("health"), async (_req, res) => {
    try {
      const result = await healthCheck();
      const statusCode = result.status === 'healthy' ? 200 :
                         result.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(result);
    } catch (error) {
      log.error({ error }, 'Health check failed');
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Metrics endpoint for Prometheus
  app.get('/metrics', metricsHandler(metrics));

  return app;
}

async function bootstrap() {
  await prisma.$connect();
  const app = buildApp({ prisma });
  const server = app.listen(settings.port, () => {
    logger.info({ msg: "attribution-service.listen", port: settings.port });
  });

  const shutdown = async () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

if (process.env.NODE_ENV !== "test") {
  bootstrap().catch((error) => {
    logger.error({ msg: "attribution-service.bootstrap_failed", error });
    process.exit(1);
  });
}
