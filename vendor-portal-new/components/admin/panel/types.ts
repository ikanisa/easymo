export interface TenantOption {
  id: string;
  name: string;
  badge?: string | null;
}

export type PanelBadgeTone = "critical" | "warning" | "info" | "success";

export type PanelIconKey =
  | "overview"
  | "saccos"
  | "groups"
  | "members"
  | "loans"
  | "staff"
  | "approvals"
  | "reconciliation"
  | "payments"
  | "ocr"
  | "notifications"
  | "reports"
  | "settings"
  | "audit"
  | "feature-flags"
  | "support";
