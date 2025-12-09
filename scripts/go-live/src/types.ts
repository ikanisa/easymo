// Export all shared types
import type { CheckStatus as SharedCheckStatus, OperationStatus, OperationResult, BatchResult } from "@easymo/migration-shared/types";

export type CheckStatus = SharedCheckStatus;
export type { OperationStatus, OperationResult, BatchResult };

// Health Check Types
export interface HealthCheck {
  name: string;
  category: string;
  status: CheckStatus;
  message: string;
  duration: number;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface HealthCheckResult {
  overall: CheckStatus;
  checks: HealthCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  duration: number;
  timestamp: string;
}

// Comparison Types
export interface DataComparison {
  table: string;
  oldCount: number;
  newCount: number;
  diff: number;
  match: boolean;
  sampleMismatches?: Array<{
    id: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

export interface ComparisonResult {
  timestamp: string;
  tables: DataComparison[];
  allMatch: boolean;
  totalOld: number;
  totalNew: number;
}

// Cutover Types
export type CutoverPhase = "pre-flight" | "freeze" | "sync" | "switch" | "verify" | "complete" | "rollback";

export interface CutoverStep {
  id: string;
  name: string;
  description: string;
  phase: CutoverPhase;
  status: "pending" | "running" | "complete" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  error?: string;
  canRollback: boolean;
  rollbackAction?: string;
}

// Alert Types
export type AlertSeverity = "info" | "warning" | "error" | "critical";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  acknowledged?: boolean;
  resolvedAt?: string;
}
