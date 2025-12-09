/**
 * Shared types for migration and go-live tooling
 */

// ─────────────────────────────────────────────────────────────
// Common Status Types
// ─────────────────────────────────────────────────────────────

export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export type OperationStatus = "pending" | "running" | "complete" | "failed" | "skipped";

// ─────────────────────────────────────────────────────────────
// Environment/System Types
// ─────────────────────────────────────────────────────────────

export interface SystemConnection {
  name: string;
  url: string;
  status: "connected" | "disconnected" | "unknown";
  latency?: number;
}

export interface EnvironmentInfo {
  timestamp: string;
  source: SystemConnection;
  target: SystemConnection;
  mode: "dry-run" | "live";
}

// ─────────────────────────────────────────────────────────────
// Progress Tracking
// ─────────────────────────────────────────────────────────────

export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  startedAt: string;
  estimatedCompletion?: string;
}

// ─────────────────────────────────────────────────────────────
// Result Types
// ─────────────────────────────────────────────────────────────

export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  duration: number;
  timestamp: string;
}

export interface BatchResult<T = unknown> {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ item: T; error: string }>;
  duration: number;
}
