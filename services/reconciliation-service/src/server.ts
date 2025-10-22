import express from "express";
import pinoHttp from "pino-http";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import axios, { type AxiosInstance } from "axios";
import { settings } from "./config.js";
import { logger } from "./logger.js";
import { IdempotencyStore } from "@easymo/messaging";
import {
  createRateLimiter,
  expressRequestContext,
  expressServiceAuth,
  getReconciliationServiceEndpointPath,
  getReconciliationServiceEndpointRequiredScopes,
  type ReconciliationServiceControllerKey,
  type ReconciliationServiceEndpointKey,
} from "@easymo/commons";

const upload = multer();

const AcceptJsonSchema = z.object({ file: z.string() });

const FeedbackResultSchema = z.object({
  reference: z.string(),
  amount: z.number(),
  currency: z.string(),
  narration: z.string(),
  status: z.enum(["credit", "manual"]),
});

type CsvResult = z.infer<typeof FeedbackResultSchema>;

type Deps = {
  store: Pick<IdempotencyStore, "execute">;
  httpClient?: AxiosInstance;
};

function processCsv(buffer: Buffer): CsvResult[] {
  const records = parse(buffer, { columns: true, skip_empty_lines: true });
  const results: CsvResult[] = [];
  for (const rec of records) {
    const narration: string = String(rec.narration ?? rec.NARRATION ?? "");
    const amount = Number(rec.amount ?? rec.AMOUNT ?? 0);
    const currency = String(rec.currency ?? rec.CURRENCY ?? "USD");
    const reference = String(rec.reference ?? rec.REFERENCE ?? "");
    const hasWallet = /WALLET:([A-Za-z0-9_-]+)/.test(narration);
    results.push({ reference, amount, currency, narration, status: hasWallet ? "credit" : "manual" });
  }
  return results;
}

export function buildApp({ store, httpClient }: Deps) {
  const app = express();
  const client = httpClient ?? axios;
  const requireAuth = <
    Controller extends ReconciliationServiceControllerKey,
    Endpoint extends ReconciliationServiceEndpointKey<Controller>,
  >(controller: Controller, endpoint: Endpoint) =>
    expressServiceAuth({
      audience: settings.auth.audience,
      requiredScopes: getReconciliationServiceEndpointRequiredScopes(controller, endpoint),
    });

  app.use(express.json({ limit: "2mb" }));
  app.use(expressRequestContext({ generateIfMissing: true }));
  app.use(pinoHttp({ logger: logger as any }));

  if (settings.rateLimit.redisUrl) {
    app.use(
      createRateLimiter({
        redisUrl: settings.rateLimit.redisUrl,
        points: settings.rateLimit.points,
        durationSeconds: settings.rateLimit.windowSeconds,
        keyPrefix: "reconciliation-service",
        logger,
      }),
    );
  }

  app.post(
    getReconciliationServiceEndpointPath("reconciliation", "mobileMoney"),
    requireAuth("reconciliation", "mobileMoney"),
    upload.single("file"),
    async (req, res) => {
    try {
      let buffer: Buffer | null = null;
      if (req.file) {
        buffer = req.file.buffer;
      } else if (req.is("application/json")) {
        const payload = AcceptJsonSchema.parse(req.body);
        buffer = Buffer.from(payload.file, "base64");
      }
      if (!buffer) return res.status(400).json({ error: "CSV file is required" });

      const items = processCsv(buffer);
      let credited = 0;
      let manual = 0;
      for (const item of items) {
        if (item.status === "credit") {
          let destAccountId: string | undefined;
          const uuidMatch = /WALLET:([0-9a-fA-F-]{36})/.exec(item.narration);
          if (uuidMatch) {
            destAccountId = uuidMatch[1];
          } else {
            const codeMatch = /WALLET:(VENDOR|AGENT|ENDORSER)-([A-Za-z0-9_-]+)/i.exec(item.narration);
            if (codeMatch) {
              const ownerType = codeMatch[1].toLowerCase();
              const ownerId = codeMatch[2];
              try {
                const resp = await client.get(`${settings.walletServiceUrl}/wallet/accounts/lookup`, {
                  params: { tenantId: settings.defaultTenantId, ownerType, ownerId, currency: item.currency },
                  timeout: 5000,
                });
                destAccountId = resp.data?.id;
              } catch (err) {
                logger.warn({ msg: "reconciliation.lookup.failed", ownerType, ownerId, error: err });
              }
            }
          }
          if (!destAccountId) {
            manual++;
            continue;
          }
          const key = `csv:${item.reference}`;
          try {
            await store.execute(key, async () => {
              await client.post(`${settings.walletServiceUrl}/wallet/transfer`, {
                tenantId: settings.defaultTenantId,
                sourceAccountId: settings.reconSourceAccountId,
                destinationAccountId: destAccountId,
                amount: item.amount,
                currency: item.currency,
                product: "topup",
                reference: item.reference,
                metadata: { narration: item.narration },
              }, { timeout: 8000 });
              return {};
            });
            credited++;
          } catch (err) {
            logger.warn({ msg: "reconciliation.credit.failed", reference: item.reference, error: err });
            manual++;
          }
        } else {
          manual++;
        }
      }
      res.status(202).json({ accepted: true, total: items.length, credited, manual });
    } catch (error) {
      logger.error({ msg: "reconciliation.parse.error", error });
      res.status(400).json({ error: (error as Error).message });
    }
    },
  );

  app.get(getReconciliationServiceEndpointPath("health", "status"), (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  (async () => {
    const store = new IdempotencyStore({ redisUrl: settings.redisUrl, namespace: "recon", ttlSeconds: 7 * 24 * 3600 });
    await store.connect();
    const app = buildApp({ store, httpClient: axios });

    const server = app.listen(settings.port, () => {
      logger.info({ msg: "reconciliation-service.listen", port: settings.port });
    });

    const shutdown = async () => {
      server.close(async () => {
        await store.disconnect();
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  })().catch((error) => {
    logger.error({ msg: "reconciliation-service.bootstrap_failed", error });
    process.exit(1);
  });
}
