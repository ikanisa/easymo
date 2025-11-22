import { PrismaService } from "@easymo/db";

import { logger } from "../logger.js";
import { ReconciliationResult,ReconciliationService } from "./service.js";

export interface ReconciliationJobConfig {
  /** Cron schedule (e.g., "0 2 * * *" for 2 AM daily) */
  schedule: string;
  
  /** Tenant IDs to reconcile (empty = all tenants) */
  tenantIds?: string[];
  
  /** Send alerts if discrepancies found */
  alertOnDiscrepancy: boolean;
  
  /** Auto-repair small discrepancies */
  autoRepair: boolean;
  
  /** Maximum auto-repair amount */
  autoRepairThreshold: number;
}

export interface ReconciliationJobResult {
  jobId: string;
  startTime: string;
  endTime: string;
  results: ReconciliationResult[];
  totalDiscrepancies: number;
  totalAccountsChecked: number;
  alertsSent: number;
  repairsPerformed: number;
}

/**
 * Reconciliation Job Scheduler
 * 
 * Runs periodic reconciliation checks and handles discrepancies
 */
export class ReconciliationScheduler {
  private reconciliationService: ReconciliationService;
  private intervalId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(prisma: PrismaService) {
    this.reconciliationService = new ReconciliationService(prisma);
  }

  /**
   * Start scheduled reconciliation jobs
   */
  start(config: ReconciliationJobConfig): void {
    if (this.isRunning) {
      logger.warn("Reconciliation scheduler already running");
      return;
    }

    logger.info({ schedule: config.schedule }, "Starting reconciliation scheduler");
    this.isRunning = true;

    // For simplicity, use interval instead of cron
    // In production, use node-cron or similar
    const intervalMs = this.parseScheduleToInterval(config.schedule);
    
    this.intervalId = setInterval(async () => {
      await this.runReconciliationJob(config);
    }, intervalMs);

    // Run immediately on start
    this.runReconciliationJob(config).catch((error) => {
      logger.error({ error: error.message }, "Initial reconciliation job failed");
    });
  }

  /**
   * Stop scheduled jobs
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    logger.info("Reconciliation scheduler stopped");
  }

  /**
   * Run a reconciliation job manually
   */
  async runReconciliationJob(config: ReconciliationJobConfig): Promise<ReconciliationJobResult> {
    const jobId = `reconciliation-${Date.now()}`;
    const startTime = new Date().toISOString();

    logger.info({ jobId }, "Starting reconciliation job");

    try {
      const results: ReconciliationResult[] = [];
      let totalDiscrepancies = 0;
      let totalAccountsChecked = 0;
      let alertsSent = 0;
      let repairsPerformed = 0;

      // Get tenants to reconcile
      const tenantIds = config.tenantIds || await this.getAllTenantIds();

      // Reconcile each tenant
      for (const tenantId of tenantIds) {
        try {
          const result = await this.reconciliationService.reconcileTenant(tenantId);
          results.push(result);
          
          totalAccountsChecked += result.accountsChecked;
          totalDiscrepancies += result.discrepancies.length;

          // Handle discrepancies
          if (result.discrepancies.length > 0) {
            // Send alerts
            if (config.alertOnDiscrepancy) {
              await this.sendDiscrepancyAlert(tenantId, result);
              alertsSent++;
            }

            // Auto-repair if enabled
            if (config.autoRepair) {
              for (const discrepancy of result.discrepancies) {
                if (discrepancy.difference <= config.autoRepairThreshold) {
                  try {
                    await this.reconciliationService.repairAccountBalance(
                      discrepancy.accountId,
                      `Auto-repair by reconciliation job ${jobId}`
                    );
                    repairsPerformed++;
                  } catch (error) {
                    logger.error({
                      accountId: discrepancy.accountId,
                      error: error instanceof Error ? error.message : String(error),
                    }, "Auto-repair failed");
                  }
                }
              }
            }
          }
        } catch (error) {
          logger.error({
            tenantId,
            error: error instanceof Error ? error.message : String(error),
          }, "Tenant reconciliation failed");
        }
      }

      const endTime = new Date().toISOString();

      const jobResult: ReconciliationJobResult = {
        jobId,
        startTime,
        endTime,
        results,
        totalDiscrepancies,
        totalAccountsChecked,
        alertsSent,
        repairsPerformed,
      };

      logger.info({
        jobId,
        totalAccountsChecked,
        totalDiscrepancies,
        alertsSent,
        repairsPerformed,
      }, "Reconciliation job completed");

      return jobResult;
    } catch (error) {
      logger.error({
        jobId,
        error: error instanceof Error ? error.message : String(error),
      }, "Reconciliation job failed");
      throw error;
    }
  }

  /**
   * Get all tenant IDs
   */
  private async getAllTenantIds(): Promise<string[]> {
    // This would query distinct tenant IDs from wallet_accounts
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Send discrepancy alert
   */
  private async sendDiscrepancyAlert(
    tenantId: string,
    result: ReconciliationResult
  ): Promise<void> {
    // In production, this would:
    // 1. Send email/Slack notification
    // 2. Create incident ticket
    // 3. Log to monitoring system
    
    logger.warn({
      tenantId,
      discrepanciesCount: result.discrepancies.length,
      totalAmount: result.totalDiscrepancyAmount,
    }, "Reconciliation discrepancy alert");

    // TODO: Implement actual alerting mechanism
  }

  /**
   * Parse cron schedule to interval (simplified)
   */
  private parseScheduleToInterval(schedule: string): number {
    // Simplified: "0 2 * * *" = daily at 2 AM = 24 hours
    // In production, use node-cron
    return 24 * 60 * 60 * 1000; // 24 hours in ms
  }
}
