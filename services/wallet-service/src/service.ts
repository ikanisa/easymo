import { PrismaService } from "@easymo/db";
import { Prisma, WalletEntryDirection } from "@prisma/client";

import { buildTransferPlan } from "./ledger";
import { logger } from "./logger";

export type TransferRequest = {
  tenantId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  reference?: string;
  metadata?: Record<string, unknown>;
  product?: string;
  // Commission-based postings removed; retained for backward compatibility but ignored
  commissionAccountId?: string;
};

export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async transfer(request: TransferRequest) {
    const amountDecimal = new Prisma.Decimal(request.amount).toDecimalPlaces(4);

    return await this.prisma.$transaction(async (tx) => {
      const accountIds = [request.sourceAccountId, request.destinationAccountId];

      const accounts = await tx.walletAccount.findMany({ where: { id: { in: accountIds } } });
      if (accounts.length !== accountIds.length) {
        throw new Error("One or more accounts were not found");
      }

      accounts.forEach((account) => {
        if (account.tenantId !== request.tenantId) {
          throw new Error("Account tenant mismatch");
        }
        if (account.currency !== request.currency) {
          throw new Error("Currency mismatch across accounts");
        }
      });

      // Commission decommissioned: no commission applied to transfers
      const commission = undefined;

      const plan = buildTransferPlan({
        amount: amountDecimal,
        sourceAccountId: request.sourceAccountId,
        destinationAccountId: request.destinationAccountId,
        commission,
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          tenantId: request.tenantId,
          type: request.product ?? "general",
          reference: request.reference,
          metadata: (request.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      await tx.walletEntry.createMany({
        data: plan.entries.map((entry) => ({
          transactionId: transaction.id,
          accountId: entry.accountId,
          amount: entry.amount,
          direction: entry.direction as WalletEntryDirection,
        })),
      });

      await Promise.all(plan.entries.map(async (entry) => {
        await tx.walletAccount.update({
          where: { id: entry.accountId },
          data: {
            balance: entry.direction === "credit"
              ? { increment: entry.amount }
              : { decrement: entry.amount },
            updatedAt: new Date(),
          },
        });
      }));

      logger.info({
        msg: "wallet.transaction.completed",
        transactionId: transaction.id,
        tenantId: request.tenantId,
        reference: request.reference,
      });

      return {
        transaction,
        entries: plan.entries,
        commissionAmount: plan.commissionAmount,
      };
    });
  }

  async getAccountSummary(accountId: string) {
    const account = await this.prisma.walletAccount.findUnique({
      where: { id: accountId },
      include: {
        tenant: true,
      },
    });
    if (!account) {
      throw new Error("Account not found");
    }

    const recentEntries = await this.prisma.walletEntry.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return {
      account,
      recentEntries,
    };
  }
}
