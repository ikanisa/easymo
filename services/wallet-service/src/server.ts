import { isFeatureEnabled, setRequestId } from "@easymo/commons";
import { PrismaService } from "@easymo/db";
import { randomUUID } from "crypto";
import express from "express";
import pinoHttp from "pino-http";
import { z } from "zod";

import { settings } from "./config";
import { FXService } from "./fx";
import { idempotencyMiddleware } from "./idempotency";
import { logger } from "./logger";
import { ReconciliationScheduler,ReconciliationService } from "./reconciliation";
import { TransferRequest,WalletService } from "./service";

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
  const reconciliation = new ReconciliationService(prisma);
  const reconciliationScheduler = new ReconciliationScheduler(prisma);

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const headerId = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : undefined;
    const requestId = headerId?.trim() || randomUUID();
    (req as any).id = requestId;
    req.headers["x-request-id"] = requestId;
    res.setHeader("x-request-id", requestId);
    setRequestId(requestId);
    next();
  });
  app.use(pinoHttp({ logger: logger as any }));
  
  // Apply idempotency middleware to financial operations
  app.use("/wallet/transfer", idempotencyMiddleware);
  app.use("/wallet/subscribe", idempotencyMiddleware);

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

  app.post("/wallet/platform/provision", async (req, res) => {
    try {
      const payload = z.object({ tenantId: z.string().uuid().default(settings.defaultTenantId) }).parse(req.body);
      const prisma = new PrismaService();
      await prisma.$connect();
      try {
        let account = await prisma.walletAccount.findFirst({ where: { tenantId: payload.tenantId, ownerType: "platform" } });
        if (!account) {
          account = await prisma.walletAccount.create({
            data: {
              tenantId: payload.tenantId,
              ownerType: "platform",
              ownerId: "platform",
              currency: "USD",
              status: "active",
            },
          });
        }
        res.status(201).json({ account });
      } finally {
        await prisma.$disconnect();
      }
    } catch (error) {
      logger.error({ msg: "wallet.platform.provision_failed", error });
      res.status(400).json({ error: (error as Error).message });
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

  // Reconciliation endpoints
  app.post("/wallet/reconcile/tenant/:tenantId", async (req, res) => {
    try {
      const { tenantId } = req.params;
      const result = await reconciliation.reconcileTenant(tenantId);
      res.json(result);
    } catch (error) {
      logger.error({ msg: "reconciliation.tenant.failed", error });
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/wallet/reconcile/account/:accountId", async (req, res) => {
    try {
      const { accountId } = req.params;
      const discrepancy = await reconciliation.reconcileAccount(accountId);
      res.json({ discrepancy });
    } catch (error) {
      logger.error({ msg: "reconciliation.account.failed", error });
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/wallet/reconcile/account/:accountId/repair", async (req, res) => {
    try {
      const { accountId } = req.params;
      const { reason } = req.body;
      
      if (!reason) {
        return res.status(400).json({ error: "reason required" });
      }

      await reconciliation.repairAccountBalance(accountId, reason);
      res.json({ success: true });
    } catch (error) {
      logger.error({ msg: "reconciliation.repair.failed", error });
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Start reconciliation scheduler if enabled
  if (process.env.ENABLE_RECONCILIATION_SCHEDULER === "true") {
    reconciliationScheduler.start({
      schedule: process.env.RECONCILIATION_SCHEDULE || "0 2 * * *",
      alertOnDiscrepancy: true,
      autoRepair: process.env.AUTO_REPAIR_DISCREPANCIES === "true",
      autoRepairThreshold: Number(process.env.AUTO_REPAIR_THRESHOLD || "1.00"),
    });

    logger.info("Reconciliation scheduler started");
  }

  const server = app.listen(settings.port, () => {
    logger.info({ msg: "wallet-service.listen", port: settings.port });
  });

  const shutdown = async () => {
    reconciliationScheduler.stop();
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
