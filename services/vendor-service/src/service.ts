import { PrismaService } from "@easymo/db";
import { Prisma } from "@prisma/client";

export type CreateVendorInput = {
  tenantId: string;
  name: string;
  region: string;
  categories: string[];
  rating?: number;
  fulfilmentRate?: number;
};

export type QuoteInput = {
  tenantId: string;
  vendorId: string;
  intentId: string;
  price: number;
  currency: string;
  etaMinutes?: number;
};

export class VendorService {
  constructor(private readonly prisma: PrismaService) {}

  private async getSettings(tenantId: string) {
    const row = await this.prisma.marketplaceSettings.findUnique({ where: { tenantId } });
    return {
      freeContacts: row?.freeContacts ?? 30,
      windowDays: row?.windowDays ?? 30,
      subscriptionTokens: row?.subscriptionTokens ?? 4,
    };
  }

  private async hasActiveSubscription(walletAccountId: string | null): Promise<boolean> {
    if (!walletAccountId) return false;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const recent = await this.prisma.walletEntry.findFirst({
      where: {
        accountId: walletAccountId,
        transaction: { type: "subscription", createdAt: { gte: since } },
      },
    });
    return !!recent;
  }

  async getEntitlements(tenantId: string, vendorId: string) {
    const cfg = await this.getSettings(tenantId);
    const vendor = await this.prisma.vendorProfile.findUnique({ where: { id: vendorId } });
    if (!vendor || vendor.tenantId !== tenantId) {
      throw new Error("Vendor not found for tenant");
    }
    const since = new Date();
    since.setDate(since.getDate() - cfg.windowDays);
    const recentQuotes = await this.prisma.quote.count({ where: { vendorId, createdAt: { gte: since } } });
    const freeRemaining = Math.max(cfg.freeContacts - recentQuotes, 0);
    const subscribed = await this.hasActiveSubscription(vendor.walletAccountId ?? null);
    const allowed = freeRemaining > 0 || subscribed;
    return { freeRemaining, subscribed, allowed, windowStart: since.toISOString() };
  }

  async createVendor(input: CreateVendorInput) {
    return await this.prisma.$transaction(async (tx) => {
      const vendor = await tx.vendorProfile.create({
        data: {
          tenant: {
            connect: { id: input.tenantId },
          },
          name: input.name,
          region: input.region,
          categories: input.categories,
          rating: input.rating ? new Prisma.Decimal(input.rating) : undefined,
          fulfilmentRate: input.fulfilmentRate ? new Prisma.Decimal(input.fulfilmentRate) : undefined,
          walletAccount: {
            create: {
              tenant: { connect: { id: input.tenantId } },
              ownerType: "vendor",
              ownerId: input.name.toLowerCase().replace(/\s+/g, "-"),
              currency: "USD",
            },
          },
        },
        include: {
          walletAccount: true,
        },
      });
      return vendor;
    });
  }

  async listVendors(tenantId: string, region?: string) {
    return await this.prisma.vendorProfile.findMany({
      where: {
        tenantId,
        ...(region ? { region } : {}),
      },
      include: {
        walletAccount: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async createQuote(input: QuoteInput) {
    const intent = await this.prisma.intent.findUnique({
      where: { id: input.intentId },
    });
    if (!intent || intent.tenantId !== input.tenantId) {
      throw new Error("Intent not found for tenant");
    }

    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { id: input.vendorId },
      include: { walletAccount: true },
    });
    if (!vendor || vendor.tenantId !== input.tenantId) {
      throw new Error("Vendor not found for tenant");
    }

    // Enforce entitlements: first 30 contacts (quotes) free within rolling 30 days; thereafter require active subscription
    const ent = await this.getEntitlements(input.tenantId, vendor.id);
    if (!ent.allowed) {
      throw new Error("subscription_required");
    }

    const quote = await this.prisma.quote.create({
      data: {
        intentId: input.intentId,
        vendorId: input.vendorId,
        price: new Prisma.Decimal(input.price),
        currency: input.currency,
        etaMinutes: input.etaMinutes,
        status: "pending",
      },
    });

    await this.prisma.vendorProfile.update({
      where: { id: vendor.id },
      data: {
        totalTrips: vendor.totalTrips + 1,
        updatedAt: new Date(),
      },
    });

    return quote;
  }
}
