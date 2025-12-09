export type ReportSubscriptionFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
export type ReportSubscriptionFormat = "PDF" | "CSV";

export interface ReportSubscriptionFilters {
  saccoId?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface ReportSubscription {
  id: string;
  saccoId: string;
  email: string;
  frequency: ReportSubscriptionFrequency;
  format: ReportSubscriptionFormat;
  deliveryHour: number;
  deliveryDay: number | null;
  filters: ReportSubscriptionFilters;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}
