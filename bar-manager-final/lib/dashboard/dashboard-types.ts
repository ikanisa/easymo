import type { DashboardKpi, TimeseriesPoint } from "@/lib/schemas";

export type DashboardSnapshot = {
  kpis: DashboardKpi[];
  timeseries: TimeseriesPoint[];
};

export type DashboardSnapshotIntegrationStatus = "ok" | "degraded";

export type DashboardSnapshotIntegration = {
  status: DashboardSnapshotIntegrationStatus;
  target: "dashboard_snapshot";
  message?: string;
  remediation?: string;
};

export type DashboardSnapshotResult = {
  data: DashboardSnapshot;
  integration: DashboardSnapshotIntegration;
};
