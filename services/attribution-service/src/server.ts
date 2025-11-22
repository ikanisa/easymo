import {
  type AttributionServiceRouteKey,
  createRateLimiter,
  expressRequestContext,
  expressServiceAuth,
  getAttributionServiceRoutePath,
  getAttributionServiceRouteRequiredScopes,
} from "@easymo/commons";
import { PrismaService } from "@easymo/db";
import express, { type Express, type RequestHandler } from "express";
import pinoHttp from "pino-http";
import { z } from "zod";

import { settings } from "./config";
import { evaluateAttribution } from "./evaluator";
import { logger } from "./logger";

const prisma = new PrismaService();

export function buildApp(deps: { prisma: PrismaService }): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(expressRequestContext({ generateIfMissing: true }));
  app.use(pinoHttp({ logger: logger as any }));

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

        const { type, entityId } = evaluateAttribution({
          referrals: payload.referrals,
          events: payload.events,
          timeboxDays: payload.timeboxDays,
        });

        if (payload.persist && payload.quoteId) {
          await deps.prisma.quote.update({
            where: { id: payload.quoteId },
            data: {
              attributionType: type.toLowerCase() as any,
              attributionEntityId: entityId,
            },
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

  app.get(getAttributionServiceRoutePath("health"), (_req, res) => {
    res.json({ status: "ok" });
  });

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
