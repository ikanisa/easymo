import express from "express";
import pinoHttp from "pino-http";
import { z } from "zod";
import { settings } from "./config";
import { logger } from "./logger";
import { PrismaService } from "@easymo/db";
import { VendorService, CreateVendorInput } from "./service";
import { isFeatureEnabled } from "@easymo/commons";

const CreateVendorSchema = z.object({
  tenantId: z.string().uuid().default(settings.defaultTenantId),
  name: z.string().min(2),
  region: z.string().min(2),
  categories: z.array(z.string()).min(1),
  rating: z.number().min(0).max(5).optional(),
  fulfilmentRate: z.number().min(0).max(1).optional(),
});

const QuoteSchema = z.object({
  tenantId: z.string().uuid().default(settings.defaultTenantId),
  intentId: z.string().uuid(),
  price: z.number().positive(),
  currency: z.string().min(3),
  etaMinutes: z.number().int().positive().optional(),
});

async function bootstrap() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const vendors = new VendorService(prisma);

  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger: logger as any }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/vendors", async (req, res) => {
    if (!isFeatureEnabled("marketplace.vendor")) {
      return res.status(403).json({ error: "Vendor service disabled" });
    }
    try {
      const payload = CreateVendorSchema.parse(req.body);
      const vendor = await vendors.createVendor(payload as CreateVendorInput);
      res.status(201).json(vendor);
    } catch (error) {
      logger.error({ msg: "vendor.create.error", error });
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/vendors", async (req, res) => {
    if (!isFeatureEnabled("marketplace.vendor")) {
      return res.status(403).json({ error: "Vendor service disabled" });
    }
    try {
      const tenantId = (req.query.tenantId as string) ?? settings.defaultTenantId;
      const region = req.query.region as string | undefined;
      const list = await vendors.listVendors(tenantId, region);
      res.json({ vendors: list });
    } catch (error) {
      logger.error({ msg: "vendor.list.error", error });
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post("/vendors/:id/quotes", async (req, res) => {
    if (!isFeatureEnabled("marketplace.vendor")) {
      return res.status(403).json({ error: "Vendor service disabled" });
    }
    try {
      const payload = QuoteSchema.parse(req.body);
      const quote = await vendors.createQuote({
        tenantId: payload.tenantId,
        vendorId: req.params.id,
        intentId: payload.intentId,
        price: payload.price,
        currency: payload.currency,
        etaMinutes: payload.etaMinutes,
      });
      res.status(201).json(quote);
    } catch (error) {
      logger.error({ msg: "vendor.quote.error", error });
      res.status(400).json({ error: (error as Error).message });
    }
  });

  const server = app.listen(settings.port, () => {
    logger.info({ msg: "vendor-service.listen", port: settings.port });
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
  logger.error({ msg: "vendor-service.bootstrap_failed", error });
  process.exit(1);
});
