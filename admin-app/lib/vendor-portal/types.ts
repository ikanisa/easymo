/**
 * Vendor Portal Types
 * Type definitions for SMS-parsed transaction tracking
 */

export interface Transaction {
  id: string;
  payerName: string;
  payerPhone: string;
  amount: number;
  currency: string;
  timestamp: Date;
  status: 'completed' | 'pending' | 'failed';
  reference?: string;
  smsSource?: string;
}

export interface Payer {
  id: string;
  name: string;
  phone: string;
  totalPaid: number;
  currency: string;
  transactionCount: number;
  lastPaymentDate: Date;
  initials: string;
}

export interface DashboardStats {
  today: {
    amount: number;
    currency: string;
    change: number;
    changeType: 'positive' | 'negative' | 'neutral';
  };
  thisWeek: {
    amount: number;
    currency: string;
    transactionCount: number;
  };
  uniquePayers: {
    count: number;
    newThisWeek: number;
  };
  thisMonth: {
    amount: number;
    currency: string;
    transactionCount: number;
  };
}

export interface RevenueDataPoint {
  day: string;
  amount: number;
  label: string;
}

export interface ReportSummary {
  totalRevenue: number;
  currency: string;
  transactionCount: number;
  uniquePayers: number;
  averageTransaction: number;
  period: 'today' | 'week' | 'month';
}

export interface FilterOption {
  id: string;
  label: string;
  value: string;
}

export type DateFilter = 'all' | 'today' | 'week' | 'month';

export type SortOption = 'total' | 'recent' | 'name';

export interface VendorProfile {
  id: string;
  name: string;
  businessName?: string;
  phone: string;
  email?: string;
  registeredDate: Date;
}
