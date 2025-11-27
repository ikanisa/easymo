import { isFeatureEnabled } from "@easymo/commons";
import { PrismaService } from "@easymo/db";
import express from "express";
import pinoHttp from "pino-http";
import { z } from "zod";

import { settings } from "./config";
import { logger } from "./logger";
import { RankingService } from "./service";

import { childLogger } from '@easymo/commons';

const log = childLogger({ service: 'ranking-service' });

const QuerySchema = z.object({
  tenantId: z.string().uuid().default(settings.defaultTenantId),
  categories: z.string().optional(),
  region: z.string().optional(),
});

async function bootstrap() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const ranking = new RankingService(prisma);

  const app = express();
  app.use(pinoHttp({ logger: logger as any }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/ranking/vendors", async (req, res) => {
    if (!isFeatureEnabled("marketplace.ranking")) {
      return res.status(403).json({ error: "Ranking service disabled" });
    }
    try {
      const query = QuerySchema.parse(req.query);
      const categories = query.categories ? query.categories.split(",").map((item) => item.trim()).filter(Boolean) : undefined;
      const result = await ranking.rankVendors({
        tenantId: query.tenantId,
        categories,
        region: query.region,
      });
      res.json({ vendors: result });
    } catch (error) {
      logger.error({ msg: "ranking.vendors.error", error });
      res.status(400).json({ error: (error as Error).message });
    }
  });

  const server = app.listen(settings.port, () => {
    logger.info({ msg: "ranking-service.listen", port: settings.port });
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

bootstrap().catch((error) => {
  logger.error({ msg: "ranking-service.bootstrap_failed", error });
  process.exit(1);
});
