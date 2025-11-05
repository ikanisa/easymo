import request from "supertest";
import { signServiceJwt } from "@easymo/commons";
import type { PrismaService } from "@easymo/db";
import type { WalletService } from "../src/service";

const DEFAULT_TENANT_ID = "a4a8cf2d-0a4f-446c-8bf2-28509641158f";

type PrismaMock = {
  walletAccount: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
};

type WalletMock = {
  transfer: jest.Mock;
  getAccountSummary: jest.Mock;
};

async function setupApp(overrides?: {
  prisma?: Partial<PrismaMock>;
  wallet?: Partial<WalletMock>;
}) {
  jest.resetModules();
  process.env.NODE_ENV = "test";
  process.env.FEATURE_WALLET_SERVICE = "1";
  process.env.SERVICE_JWT_KEYS = "test-secret";
  process.env.SERVICE_JWT_ISSUER = "test-issuer";
  process.env.SERVICE_NAME = "wallet-service";
  process.env.SERVICE_AUTH_AUDIENCE = "wallet-service";
  process.env.DEFAULT_TENANT_ID = DEFAULT_TENANT_ID;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  delete process.env.RATE_LIMIT_REDIS_URL;

  const prismaMock: PrismaMock = {
    walletAccount: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "wallet-1" }),
    },
  };

  const walletMock: WalletMock = {
    transfer: jest.fn().mockResolvedValue({
      transaction: { id: "txn-1" },
      entries: [],
      commissionAmount: 0,
    }),
    getAccountSummary: jest.fn().mockResolvedValue({ id: "wallet-1", balance: 0 }),
  };

  Object.assign(prismaMock, overrides?.prisma);
  Object.assign(walletMock, overrides?.wallet);

  const module = await import("../src/server");
  const app = module.buildApp({
    prisma: prismaMock as unknown as PrismaService,
    wallet: walletMock as unknown as WalletService,
  });

  return { app, prismaMock, walletMock };
}

describe("wallet-service authentication", () => {
  it("rejects missing bearer token", async () => {
    const { app } = await setupApp();

    const response = await request(app)
      .post("/wallet/transfer")
      .send({
        tenantId: DEFAULT_TENANT_ID,
        sourceAccountId: "11111111-1111-1111-1111-111111111111",
        destinationAccountId: "22222222-2222-2222-2222-222222222222",
        amount: 10,
        currency: "USD",
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing_token");
  });

  it("rejects insufficient scope", async () => {
    const { app } = await setupApp();
    const token = await signServiceJwt({ audience: "wallet-service", scope: ["wallet:accounts.read"] });

    const response = await request(app)
      .post("/wallet/transfer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tenantId: DEFAULT_TENANT_ID,
        sourceAccountId: "11111111-1111-1111-1111-111111111111",
        destinationAccountId: "22222222-2222-2222-2222-222222222222",
        amount: 10,
        currency: "USD",
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("invalid_scope");
  });

  it("allows valid scope", async () => {
    const transfer = jest.fn().mockResolvedValue({
      transaction: { id: "txn-1" },
      entries: [],
      commissionAmount: 5,
    });
    const { app, walletMock } = await setupApp({ wallet: { transfer } });
    const token = await signServiceJwt({ audience: "wallet-service", scope: ["wallet:transfer.write"] });

    const response = await request(app)
      .post("/wallet/transfer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        tenantId: DEFAULT_TENANT_ID,
        sourceAccountId: "11111111-1111-1111-1111-111111111111",
        destinationAccountId: "22222222-2222-2222-2222-222222222222",
        amount: 10,
        currency: "USD",
      });

    expect(response.status).toBe(201);
    expect(transfer).toHaveBeenCalledTimes(1);
    expect(walletMock.transfer).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10, currency: "USD" }),
    );
  });
});
