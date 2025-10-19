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
    });
    if (!vendor || vendor.tenantId !== input.tenantId) {
      throw new Error("Vendor not found for tenant");
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
