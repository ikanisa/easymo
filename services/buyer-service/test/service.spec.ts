import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BuyerService } from "../src/service";

const prismaMock: any = {
  buyerProfile: { findUnique: vi.fn() },
  intent: { create: vi.fn(), findMany: vi.fn() },
  quote: { findUnique: vi.fn(), update: vi.fn() },
  purchase: { create: vi.fn(), findMany: vi.fn() },
};

describe("BuyerService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("throws when buyer tenant mismatches", async () => {
    prismaMock.buyerProfile.findUnique.mockResolvedValue({ id: "buyer", tenantId: "other" });
    const service = new BuyerService(prismaMock);
    await expect(service.createIntent({
      tenantId: "tenant",
      buyerId: "buyer",
      channel: "whatsapp",
      payload: {},
    })).rejects.toThrow("Buyer not found for tenant");
  });

  it("summarises intents with quote counts", async () => {
    prismaMock.buyerProfile.findUnique.mockResolvedValue({ id: "buyer", tenantId: "tenant" });
    prismaMock.intent.findMany.mockResolvedValue([
      {
        id: "intent-1",
        tenantId: "tenant",
        buyerId: "buyer",
        channel: "whatsapp",
        status: "pending",
        createdAt: new Date(),
        expiresAt: null,
        buyer: { name: "Buyer" },
        quotes: [{ id: "quote-1" }, { id: "quote-2" }],
      },
    ]);

    const service = new BuyerService(prismaMock);
    const intents = await service.listIntents("tenant");
    expect(intents[0].recentQuotes).toBe(2);
  });

  it("summarises purchases with vendor and buyer names", async () => {
    prismaMock.purchase.findMany.mockResolvedValue([
      {
        id: "purchase-1",
        quoteId: "quote-1",
        status: "completed",
        createdAt: new Date(),
        fulfilledAt: new Date(),
        quote: {
          vendor: { name: "Vendor" },
          intent: { buyer: { name: "Buyer" }, tenantId: "tenant" },
          price: { toNumber: () => 25 },
          currency: "USD",
        },
      },
    ]);

    const service = new BuyerService(prismaMock);
    const purchases = await service.listPurchases("tenant");
    expect(purchases[0].vendorName).toBe("Vendor");
    expect(purchases[0].buyerName).toBe("Buyer");
    expect(purchases[0].amount).toBe(25);
  });
});
