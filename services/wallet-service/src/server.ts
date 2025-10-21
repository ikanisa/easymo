import express from "express";
import pinoHttp from "pino-http";
import { z } from "zod";
import { settings } from "./config";
import { logger } from "./logger";
import { PrismaService } from "@easymo/db";
import { WalletService, TransferRequest } from "./service";
import { FXService } from "./fx";
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
  const fx = new FXService(process.env.EXCHANGE_RATES_API);

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

  app.post("/wallet/subscribe", async (req, res) => {
    if (!isFeatureEnabled("wallet.service")) {
      return res.status(403).json({ error: "Wallet service is disabled" });
    }
    try {
      const payload = z.object({
        tenantId: z.string().uuid().default(settings.defaultTenantId),
        vendorId: z.string().uuid().optional(),
        accountId: z.string().uuid().optional(),
        tokens: z.number().positive().default(4),
      }).parse(req.body);

      const prisma = new PrismaService();
      await prisma.$connect();
      try {
        // Resolve vendor wallet account
        let vendorAccountId: string | null = payload.accountId ?? null;
        if (!vendorAccountId && payload.vendorId) {
          const vendor = await prisma.vendorProfile.findUnique({ where: { id: payload.vendorId } });
          vendorAccountId = vendor?.walletAccountId ?? null;
        }
        if (!vendorAccountId) {
          return res.status(400).json({ error: "missing_vendor_account" });
        }
        const vendorAcc = await prisma.walletAccount.findUnique({ where: { id: vendorAccountId } });
        if (!vendorAcc || vendorAcc.tenantId !== payload.tenantId) {
          return res.status(400).json({ error: "invalid_vendor_account" });
        }
        if (vendorAcc.currency !== "USD") {
          return res.status(400).json({ error: "unsupported_currency", message: "Vendor wallet must be USD (token-pegged)." });
        }

        const platformAcc = await prisma.walletAccount.findFirst({ where: { tenantId: payload.tenantId, ownerType: "platform" } });
        if (!platformAcc) {
          return res.status(400).json({ error: "platform_account_missing" });
        }
        if (platformAcc.currency !== vendorAcc.currency) {
          return res.status(400).json({ error: "currency_mismatch" });
        }

        const result = await wallet.transfer({
          tenantId: payload.tenantId,
          sourceAccountId: vendorAcc.id,
          destinationAccountId: platformAcc.id,
          amount: payload.tokens,
          currency: vendorAcc.currency,
          product: "subscription",
          reference: `subscription/${new Date().toISOString().slice(0, 10)}`,
          metadata: { tokens: payload.tokens },
        } as TransferRequest);

        res.status(201).json({
          transactionId: result.transaction.id,
          tokensCharged: payload.tokens,
          currency: vendorAcc.currency,
        });
      } finally {
        await prisma.$disconnect();
      }
    } catch (error) {
      logger.error({ msg: "wallet.subscribe.failed", error });
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/fx/convert", async (req, res) => {
    try {
      const amount = Number(req.query.amount ?? 0);
      const currency = String(req.query.currency ?? "USD");
      if (!(amount > 0)) {
        return res.status(400).json({ error: "invalid_amount" });
      }
      const tokens = await fx.convertToUsdTokens(amount, currency);
      res.json({ amount, currency, tokens, usd: tokens });
    } catch (error) {
      logger.error({ msg: "wallet.fx.failed", error });
      res.status(500).json({ error: "fx_error" });
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
