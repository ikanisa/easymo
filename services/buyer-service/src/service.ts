import { isFeatureEnabled } from "@easymo/commons";
import { PrismaService } from "@easymo/db";
import { Prisma } from "@prisma/client";
import axios from "axios";

import { settings } from "./config";
import { logger } from "./logger";
import { fetchBuyerTrips } from "./trips";

export type CreateBuyerInput = {
  tenantId: string;
  name: string;
  segment?: string;
};

export type CreateIntentInput = {
  tenantId: string;
  buyerId: string;
  channel: string;
  payload: Record<string, unknown>;
  expiresAt?: Date;
};

export type PurchaseInput = {
  tenantId: string;
  quoteId: string;
  amount: number;
  currency: string;
};

export class BuyerService {
  constructor(private readonly prisma: PrismaService) {}

  async createBuyer(input: CreateBuyerInput) {
    return await this.prisma.$transaction(async (tx) => {
      const buyer = await tx.buyerProfile.create({
        data: {
          tenant: {
            connect: { id: input.tenantId },
          },
          name: input.name,
          segment: input.segment,
          walletAccount: {
            create: {
              tenant: { connect: { id: input.tenantId } },
              ownerType: "buyer",
              ownerId: input.name.toLowerCase().replace(/\s+/g, "-"),
              currency: "USD",
            },
          },
        },
        include: {
          walletAccount: true,
        },
      });
      return buyer;
    });
  }

  async createIntent(input: CreateIntentInput) {
    const buyer = await this.prisma.buyerProfile.findUnique({ where: { id: input.buyerId } });
    if (!buyer || buyer.tenantId !== input.tenantId) {
      throw new Error("Buyer not found for tenant");
    }
    return await this.prisma.intent.create({
      data: {
        tenant: { connect: { id: input.tenantId } },
        buyer: { connect: { id: input.buyerId } },
        channel: input.channel,
        payload: input.payload as Prisma.InputJsonValue,
        expiresAt: input.expiresAt,
      },
    });
  }

  async recordPurchase(input: PurchaseInput) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: input.quoteId },
      include: {
        intent: {
          include: { buyer: { include: { walletAccount: true } } },
        },
        vendor: { include: { walletAccount: true } },
      },
    });
    if (!quote || quote.intent.tenantId !== input.tenantId) {
      throw new Error("Quote not found for tenant");
    }

    const buyerAccount = quote.intent.buyer.walletAccount;
    const vendorAccount = quote.vendor.walletAccount;
    if (!buyerAccount || !vendorAccount) {
      throw new Error("Missing wallet accounts for purchase");
    }

    let transactionId: string | undefined;
    if (settings.walletServiceUrl && isFeatureEnabled("wallet.service")) {
      try {
        const response = await axios.post(`${settings.walletServiceUrl}/wallet/transfer`, {
          tenantId: input.tenantId,
          sourceAccountId: buyerAccount.id,
          destinationAccountId: vendorAccount.id,
          amount: input.amount,
          currency: input.currency,
          product: "marketplace",
        }, {
          headers: { "Content-Type": "application/json" },
        });
        transactionId = response.data?.transaction?.id;
      } catch (error) {
        logger.error({ msg: "buyer.purchase.wallet_failed", error });
      }
    }

    const purchase = await this.prisma.purchase.create({
      data: {
        quoteId: quote.id,
        transactionId,
        status: transactionId ? "completed" : "pending",
        fulfilledAt: transactionId ? new Date() : undefined,
      },
    });

    await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
      },
    });

    return purchase;
  }

  async buyerContext(buyerId: string) {
    const buyer = await this.prisma.buyerProfile.findUnique({
      where: { id: buyerId },
      include: {
        walletAccount: true,
        intents: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });
    if (!buyer) {
      throw new Error("Buyer not found");
    }

    const trips = await fetchBuyerTrips(buyerId);
    return {
      buyer,
      trips,
    };
  }

  async listIntents(tenantId: string, limit = 25) {
    const intents = await this.prisma.intent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        buyer: true,
        quotes: true,
      },
    });

    return intents.map((intent) => ({
      id: intent.id,
      buyerName: intent.buyer.name,
      channel: intent.channel,
      status: intent.status,
      createdAt: intent.createdAt,
      expiresAt: intent.expiresAt,
      recentQuotes: intent.quotes.length,
    }));
  }

  async listPurchases(tenantId: string, limit = 25) {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        quote: {
          intent: { tenantId },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        quote: {
          include: {
            vendor: true,
            intent: { include: { buyer: true } },
          },
        },
      },
    });

    return purchases.map((purchase) => ({
      id: purchase.id,
      quoteId: purchase.quoteId,
      vendorName: purchase.quote.vendor.name,
      buyerName: purchase.quote.intent.buyer.name,
      status: purchase.status,
      createdAt: purchase.createdAt,
      fulfilledAt: purchase.fulfilledAt,
      amount: purchase.quote.price?.toNumber?.() ?? null,
      currency: purchase.quote.currency,
    }));
  }
}
