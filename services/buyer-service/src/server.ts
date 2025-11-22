import { isFeatureEnabled } from "@easymo/commons";
import { PrismaService } from "@easymo/db";
import express from "express";
import pinoHttp from "pino-http";
import { z } from "zod";

import { settings } from "./config";
import { logger } from "./logger";
import { BuyerService, CreateBuyerInput, PurchaseInput } from "./service";

const CreateBuyerSchema = z.object({
  tenantId: z.string().uuid().default(settings.defaultTenantId),
  name: z.string().min(2),
  segment: z.string().optional(),
});

const IntentSchema = z.object({
  tenantId: z.string().uuid().default(settings.defaultTenantId),
  channel: z.string().min(2),
  payload: z.record(z.any()),
  expiresAt: z.string().datetime().optional(),
});

const PurchaseSchema = z.object({
  tenantId: z.string().uuid().default(settings.defaultTenantId),
  quoteId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(3),
});

const TenantQuerySchema = z.object({
  tenantId: z.string().uuid().default(settings.defaultTenantId),
  limit: z.coerce.number().min(1).max(100).default(25),
});

async function bootstrap() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const buyers = new BuyerService(prisma);

  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger: logger as any }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/buyers", async (req, res) => {
    if (!isFeatureEnabled("marketplace.buyer")) {
      return res.status(403).json({ error: "Buyer service disabled" });
    }
    try {
      const payload = CreateBuyerSchema.parse(req.body);
      const buyer = await buyers.createBuyer(payload as CreateBuyerInput);
      res.status(201).json(buyer);
    } catch (error) {
      logger.error({ msg: "buyer.create.error", error });
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post("/buyers/:id/intents", async (req, res) => {
    if (!isFeatureEnabled("marketplace.buyer")) {
      return res.status(403).json({ error: "Buyer service disabled" });
    }
    try {
      const payload = IntentSchema.parse(req.body);
      const intent = await buyers.createIntent({
        tenantId: payload.tenantId,
        buyerId: req.params.id,
        channel: payload.channel,
        payload: payload.payload,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      });
      res.status(201).json(intent);
    } catch (error) {
      logger.error({ msg: "buyer.intent.error", error });
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post("/purchases", async (req, res) => {
    if (!isFeatureEnabled("marketplace.buyer")) {
      return res.status(403).json({ error: "Buyer service disabled" });
    }
    try {
      const payload = PurchaseSchema.parse(req.body);
      const purchase = await buyers.recordPurchase(payload as PurchaseInput);
      res.status(201).json(purchase);
    } catch (error) {
      logger.error({ msg: "buyer.purchase.error", error });
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/intents", async (req, res) => {
    if (!isFeatureEnabled("marketplace.buyer")) {
      return res.status(403).json({ error: "Buyer service disabled" });
    }
    try {
      const query = TenantQuerySchema.parse({
        tenantId: req.query.tenantId,
        limit: req.query.limit,
      });
      const intents = await buyers.listIntents(query.tenantId, query.limit);
      res.json({ intents });
    } catch (error) {
      logger.error({ msg: "buyer.intents.error", error });
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/purchases", async (req, res) => {
    if (!isFeatureEnabled("marketplace.buyer")) {
      return res.status(403).json({ error: "Buyer service disabled" });
    }
    try {
      const query = TenantQuerySchema.parse({
        tenantId: req.query.tenantId,
        limit: req.query.limit,
      });
      const purchases = await buyers.listPurchases(query.tenantId, query.limit);
      res.json({ purchases });
    } catch (error) {
      logger.error({ msg: "buyer.purchases.error", error });
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/buyers/:id/context", async (req, res) => {
    if (!isFeatureEnabled("marketplace.buyer")) {
      return res.status(403).json({ error: "Buyer service disabled" });
    }
    try {
      const context = await buyers.buyerContext(req.params.id);
      res.json(context);
    } catch (error) {
      logger.error({ msg: "buyer.context.error", error });
      res.status(404).json({ error: (error as Error).message });
    }
  });

  const server = app.listen(settings.port, () => {
    logger.info({ msg: "buyer-service.listen", port: settings.port });
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
  logger.error({ msg: "buyer-service.bootstrap_failed", error });
  process.exit(1);
});
