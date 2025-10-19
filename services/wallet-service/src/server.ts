import express from "express";
import pinoHttp from "pino-http";
import { z } from "zod";
import { settings } from "./config";
import { logger } from "./logger";
import { PrismaService } from "@easymo/db";
import { WalletService, TransferRequest } from "./service";
import { isFeatureEnabled } from "@easymo/commons";

const TransferSchema = z.object({
  tenantId: z.string().uuid().default(settings.defaultTenantId),
  sourceAccountId: z.string().uuid(),
  destinationAccountId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(3),
  reference: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  product: z.string().optional(),
  commissionAccountId: z.string().uuid().optional(),
});

async function bootstrap() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const wallet = new WalletService(prisma);

  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger: logger as any }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/wallet/transfer", async (req, res) => {
    if (!isFeatureEnabled("wallet.service")) {
      return res.status(403).json({ error: "Wallet service is disabled" });
    }
    try {
      const payload = TransferSchema.parse(req.body);
      const response = await wallet.transfer(payload as TransferRequest);
      res.status(201).json({
        transaction: response.transaction,
        entries: response.entries,
        commissionAmount: response.commissionAmount,
      });
    } catch (error) {
      logger.error({ msg: "wallet.transfer.failed", error });
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/wallet/accounts/:id", async (req, res) => {
    if (!isFeatureEnabled("wallet.service")) {
      return res.status(403).json({ error: "Wallet service is disabled" });
    }
    try {
      const result = await wallet.getAccountSummary(req.params.id);
      res.json(result);
    } catch (error) {
      logger.error({ msg: "wallet.account.fetch_failed", error });
      res.status(404).json({ error: (error as Error).message });
    }
  });

  const server = app.listen(settings.port, () => {
    logger.info({ msg: "wallet-service.listen", port: settings.port });
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
  logger.error({ msg: "wallet-service.bootstrap_failed", error });
  process.exit(1);
});
