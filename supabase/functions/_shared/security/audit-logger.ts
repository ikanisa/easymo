/**
 * Audit Logging System
 * Tracks sensitive operations for security and compliance
 */

import { logStructuredEvent } from "../observability.ts";

export type AuditAction = 
  | "AUTH_SUCCESS" | "AUTH_FAILURE" | "AUTH_BYPASS"
  | "PROFILE_CREATE" | "PROFILE_UPDATE" | "PROFILE_DELETE" | "PROFILE_VIEW"
  | "WALLET_TRANSFER" | "WALLET_DEPOSIT" | "WALLET_WITHDRAWAL" | "WALLET_BALANCE_VIEW"
  | "BUSINESS_CREATE" | "BUSINESS_UPDATE" | "BUSINESS_DELETE"
  | "VEHICLE_ADD" | "VEHICLE_UPDATE" | "VEHICLE_DELETE"
  | "TRIP_CREATE" | "TRIP_ACCEPT" | "TRIP_START" | "TRIP_COMPLETE" | "TRIP_CANCEL"
  | "INSURANCE_DOCUMENT_UPLOAD" | "INSURANCE_CLAIM_SUBMIT" | "INSURANCE_CLAIM_STATUS"
  | "ADMIN_NOTIFY" | "ADMIN_ACTION"
  | "RATE_LIMIT_EXCEEDED" | "SECURITY_VIOLATION" | "SUSPICIOUS_ACTIVITY";

export type AuditSeverity = "low" | "medium" | "high" | "critical";

export type AuditEntry = {
  timestamp: string;
  service: string;
  action: AuditAction;
  severity: AuditSeverity;
  userId?: string;
  sessionId?: string;
  requestId: string;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  resourceId?: string;
  details: Record<string, unknown>;
  outcome: "success" | "failure" | "partial";
  errorMessage?: string;
};

export class AuditLogger {
  private serviceName: string;
  private supabaseClient: any;

  constructor(serviceName: string, supabaseClient?: any) {
    this.serviceName = serviceName;
    this.supabaseClient = supabaseClient;
  }

  async log(entry: Omit<AuditEntry, "timestamp" | "service">): Promise<void> {
    const fullEntry: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      service: this.serviceName,
    };

    logStructuredEvent(`AUDIT_${entry.action}`, {
      ...fullEntry,
      details: this.maskSensitiveData(entry.details),
    }, this.getSeverityLevel(entry.severity));

    if (this.supabaseClient && this.shouldPersist(entry.action, entry.severity)) {
      await this.persistToDatabase(fullEntry);
    }
  }

  async logAuth(
    requestId: string,
    correlationId: string,
    outcome: "success" | "failure",
    details: {
      userId?: string;
      method?: string;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    await this.log({
      action: outcome === "success" ? "AUTH_SUCCESS" : "AUTH_FAILURE",
      severity: outcome === "success" ? "low" : "medium",
      requestId,
      correlationId,
      userId: details.userId,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      details: {
        method: details.method,
        reason: details.reason,
      },
      outcome,
    });
  }

  async logWalletTransaction(
    requestId: string,
    correlationId: string,
    action: "WALLET_TRANSFER" | "WALLET_DEPOSIT" | "WALLET_WITHDRAWAL",
    details: {
      userId: string;
      amount: number;
      currency?: string;
      recipientId?: string;
      transactionId?: string;
      success: boolean;
      error?: string;
    }
  ): Promise<void> {
    await this.log({
      action,
      severity: "high",
      requestId,
      correlationId,
      userId: details.userId,
      resource: "wallet",
      resourceId: details.transactionId,
      details: {
        amount: details.amount,
        currency: details.currency ?? "tokens",
        recipientId: details.recipientId ? this.maskId(details.recipientId) : undefined,
      },
      outcome: details.success ? "success" : "failure",
      errorMessage: details.error,
    });
  }

  async logSecurityViolation(
    requestId: string,
    correlationId: string,
    details: {
      type: "sql_injection" | "xss" | "rate_limit" | "invalid_signature" | "unauthorized";
      ipAddress?: string;
      userAgent?: string;
      payload?: string;
    }
  ): Promise<void> {
    await this.log({
      action: "SECURITY_VIOLATION",
      severity: "critical",
      requestId,
      correlationId,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      details: {
        type: details.type,
        payload: details.payload?.slice(0, 100),
      },
      outcome: "failure",
    });
  }

  private maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ["password", "token", "secret", "key", "phone", "email", "ssn"];
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
        masked[key] = "***MASKED***";
      } else if (typeof value === "object" && value !== null) {
        masked[key] = this.maskSensitiveData(value as Record<string, unknown>);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  private maskId(id: string): string {
    if (id.length <= 8) return "***";
    return id.slice(0, 4) + "***" + id.slice(-4);
  }

  private getSeverityLevel(severity: AuditSeverity): "debug" | "info" | "warn" | "error" {
    switch (severity) {
      case "low": return "debug";
      case "medium": return "info";
      case "high": return "warn";
      case "critical": return "error";
    }
  }

  private shouldPersist(action: AuditAction, severity: AuditSeverity): boolean {
    if (severity === "high" || severity === "critical") return true;
    if (action.startsWith("WALLET_")) return true;
    if (action.startsWith("SECURITY_") || action === "AUTH_FAILURE") return true;
    return false;
  }

  private async persistToDatabase(entry: AuditEntry): Promise<void> {
    if (!this.supabaseClient) return;

    try {
      await this.supabaseClient.from("audit_logs").insert({
        timestamp: entry.timestamp,
        service: entry.service,
        action: entry.action,
        severity: entry.severity,
        user_id: entry.userId,
        request_id: entry.requestId,
        correlation_id: entry.correlationId,
        ip_address: entry.ipAddress,
        resource: entry.resource,
        resource_id: entry.resourceId,
        details: entry.details,
        outcome: entry.outcome,
        error_message: entry.errorMessage,
      });
    } catch (error) {
      logStructuredEvent("AUDIT_PERSIST_ERROR", {
        error: error instanceof Error ? error.message : String(error),
        action: entry.action,
      }, "error");
    }
  }
}

export function createAuditLogger(serviceName: string, supabaseClient?: any): AuditLogger {
  return new AuditLogger(serviceName, supabaseClient);
}
