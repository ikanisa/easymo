import { z } from "zod";

const TransferRequestSchema = z.object({
  tenantId: z.string().uuid(),
  sourceAccountId: z.string().uuid(),
  destinationAccountId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(3),
  reference: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  product: z.string().optional(),
  commissionAccountId: z.string().uuid().optional(),
});

const TransferResponseSchema = z
  .object({
    transaction: z.record(z.any()),
    entries: z.array(z.record(z.any())),
    commissionAmount: z.number().optional(),
  })
  .passthrough();

const AccountSummarySchema = z.record(z.any());

const PlatformProvisionRequestSchema = z.object({
  tenantId: z.string().uuid(),
});

const PlatformProvisionResponseSchema = z.object({
  account: z.record(z.any()),
});

const SubscribeRequestSchema = z.object({
  tenantId: z.string().uuid(),
  vendorId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  tokens: z.number().positive().default(4),
});

const SubscribeResponseSchema = z.object({
  transactionId: z.string(),
  tokensCharged: z.number(),
  currency: z.string(),
});

const FxConvertResponseSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  tokens: z.number(),
  usd: z.number(),
});

const ReconcileTenantResponseSchema = z.record(z.any());
const ReconcileAccountResponseSchema = z.object({ discrepancy: z.any() }).passthrough();
const RepairAccountRequestSchema = z.object({ reason: z.string().min(1) });

const HealthResponseSchema = z.object({
  status: z.literal("ok"),
});

export const serviceContract = {
  name: "wallet-service",
  version: "1.0.0",
  endpoints: [
    {
      id: "health.status",
      method: "GET",
      path: "/health",
      auth: "public",
      responseSchema: HealthResponseSchema,
    },
    {
      id: "wallet.transfer",
      method: "POST",
      path: "/wallet/transfer",
      auth: "service",
      requestSchema: TransferRequestSchema,
      responseSchema: TransferResponseSchema,
    },
    {
      id: "wallet.account.summary",
      method: "GET",
      path: "/wallet/accounts/:id",
      auth: "service",
      responseSchema: AccountSummarySchema,
    },
    {
      id: "wallet.platform.provision",
      method: "POST",
      path: "/wallet/platform/provision",
      auth: "service",
      requestSchema: PlatformProvisionRequestSchema,
      responseSchema: PlatformProvisionResponseSchema,
    },
    {
      id: "wallet.subscribe",
      method: "POST",
      path: "/wallet/subscribe",
      auth: "service",
      requestSchema: SubscribeRequestSchema,
      responseSchema: SubscribeResponseSchema,
    },
    {
      id: "wallet.fx.convert",
      method: "GET",
      path: "/fx/convert",
      auth: "service",
      responseSchema: FxConvertResponseSchema,
    },
    {
      id: "wallet.reconcile.tenant",
      method: "POST",
      path: "/wallet/reconcile/tenant/:tenantId",
      auth: "admin",
      responseSchema: ReconcileTenantResponseSchema,
    },
    {
      id: "wallet.reconcile.account",
      method: "POST",
      path: "/wallet/reconcile/account/:accountId",
      auth: "admin",
      responseSchema: ReconcileAccountResponseSchema,
    },
    {
      id: "wallet.reconcile.repair",
      method: "POST",
      path: "/wallet/reconcile/account/:accountId/repair",
      auth: "admin",
      requestSchema: RepairAccountRequestSchema,
      responseSchema: z.object({ success: z.boolean() }).passthrough(),
    },
  ],
  events: [],
  dependencies: ["db"],
} as const;

export type WalletServiceContract = typeof serviceContract;
