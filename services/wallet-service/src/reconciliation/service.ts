import { PrismaService } from "@easymo/db";

import { logger } from "../logger.js";

export interface ReconciliationResult {
  tenantId: string;
  accountsChecked: number;
  discrepancies: AccountDiscrepancy[];
  totalDiscrepancyAmount: number;
  timestamp: string;
}

export interface AccountDiscrepancy {
  accountId: string;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
  currency: string;
  entriesCount: number;
}

/**
 * Wallet Reconciliation Service
 * 
 * Verifies that account balances match the sum of their ledger entries.
 * Detects and reports discrepancies for investigation.
 */
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reconcile all accounts for a tenant
   */
  async reconcileTenant(tenantId: string): Promise<ReconciliationResult> {
    const startTime = Date.now();
    logger.info({ tenantId }, "Starting tenant reconciliation");

    try {
      // Get all accounts for tenant
      const accounts = await this.prisma.walletAccount.findMany({
        where: { tenantId },
        include: {
          entries: {
            select: {
              amount: true,
              currency: true,
            },
          },
        },
      });

      const discrepancies: AccountDiscrepancy[] = [];
      let totalDiscrepancyAmount = 0;

      // Check each account
      for (const account of accounts) {
        const calculatedBalance = account.entries.reduce((sum, entry) => {
          return sum + Number(entry.amount);
        }, 0);

        const actualBalance = Number(account.balance);
        const difference = Math.abs(actualBalance - calculatedBalance);

        // Allow small rounding differences (0.01)
        if (difference > 0.01) {
          discrepancies.push({
            accountId: account.id,
            expectedBalance: calculatedBalance,
            actualBalance,
            difference,
            currency: account.currency,
            entriesCount: account.entries.length,
          });

          totalDiscrepancyAmount += difference;

          logger.warn({
            accountId: account.id,
            expectedBalance: calculatedBalance,
            actualBalance,
            difference,
            currency: account.currency,
          }, "Account balance discrepancy detected");
        }
      }

      const duration = Date.now() - startTime;

      const result: ReconciliationResult = {
        tenantId,
        accountsChecked: accounts.length,
        discrepancies,
        totalDiscrepancyAmount,
        timestamp: new Date().toISOString(),
      };

      logger.info({
        tenantId,
        accountsChecked: accounts.length,
        discrepanciesFound: discrepancies.length,
        duration,
      }, "Tenant reconciliation completed");

      return result;
    } catch (error) {
      logger.error({
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      }, "Reconciliation failed");
      throw error;
    }
  }

  /**
   * Reconcile a specific account
   */
  async reconcileAccount(accountId: string): Promise<AccountDiscrepancy | null> {
    logger.info({ accountId }, "Starting account reconciliation");

    try {
      const account = await this.prisma.walletAccount.findUnique({
        where: { id: accountId },
        include: {
          entries: {
            select: {
              amount: true,
              currency: true,
            },
          },
        },
      });

      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const calculatedBalance = account.entries.reduce((sum, entry) => {
        return sum + Number(entry.amount);
      }, 0);

      const actualBalance = Number(account.balance);
      const difference = Math.abs(actualBalance - calculatedBalance);

      if (difference > 0.01) {
        const discrepancy: AccountDiscrepancy = {
          accountId: account.id,
          expectedBalance: calculatedBalance,
          actualBalance,
          difference,
          currency: account.currency,
          entriesCount: account.entries.length,
        };

        logger.warn({
          accountId,
          expectedBalance: calculatedBalance,
          actualBalance,
          difference,
        }, "Account discrepancy detected");

        return discrepancy;
      }

      logger.info({ accountId }, "Account reconciliation passed");
      return null;
    } catch (error) {
      logger.error({
        accountId,
        error: error instanceof Error ? error.message : String(error),
      }, "Account reconciliation failed");
      throw error;
    }
  }

  /**
   * Repair account balance based on ledger entries
   * USE WITH CAUTION - creates audit trail
   */
  async repairAccountBalance(accountId: string, reason: string): Promise<void> {
    logger.warn({ accountId, reason }, "Initiating account balance repair");

    try {
      await this.prisma.$transaction(async (tx) => {
        const account = await tx.walletAccount.findUnique({
          where: { id: accountId },
          include: {
            entries: {
              select: { amount: true },
            },
          },
        });

        if (!account) {
          throw new Error(`Account ${accountId} not found`);
        }

        const calculatedBalance = account.entries.reduce((sum, entry) => {
          return sum + Number(entry.amount);
        }, 0);

        const oldBalance = Number(account.balance);

        // Update account balance
        await tx.walletAccount.update({
          where: { id: accountId },
          data: { balance: calculatedBalance },
        });

        // Create audit record (if audit table exists)
        logger.info({
          accountId,
          oldBalance,
          newBalance: calculatedBalance,
          difference: calculatedBalance - oldBalance,
          reason,
        }, "Account balance repaired");
      });
    } catch (error) {
      logger.error({
        accountId,
        error: error instanceof Error ? error.message : String(error),
      }, "Account repair failed");
      throw error;
    }
  }

  /**
   * Get reconciliation summary for all tenants
   */
  async getReconciliationSummary(): Promise<{
    totalAccounts: number;
    tenantsChecked: number;
    totalDiscrepancies: number;
  }> {
    // This would typically query a reconciliation_reports table
    // For now, return placeholder
    return {
      totalAccounts: 0,
      tenantsChecked: 0,
      totalDiscrepancies: 0,
    };
  }
}
