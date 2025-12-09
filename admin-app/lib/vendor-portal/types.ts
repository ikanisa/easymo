/**
 * Vendor Portal Types
 * Type definitions for SMS-parsed transaction tracking and SACCO management
 */

// ==================== Legacy Types (Phase 2) ====================

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

// ==================== Phase 3: SACCO Types ====================

export interface Sacco {
  id: string;
  name: string;
  code: string;
  phone?: string;
  email?: string;
  address?: string;
  registration_number?: string;
  settings: Record<string, unknown>;
  webhook_url?: string;
  webhook_secret?: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: Date;
  updated_at: Date;
}

export interface StaffUser {
  id: string;
  user_id?: string;
  sacco_id: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
  full_name: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  permissions: Record<string, unknown>;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Member {
  id: string;
  sacco_id: string;
  full_name: string;
  phone: string;
  national_id?: string;
  account_number?: string;
  account_type: 'savings' | 'loan' | 'shares';
  balance: number;
  status: 'active' | 'inactive' | 'suspended';
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface Group {
  id: string;
  sacco_id: string;
  name: string;
  code: string;
  type: 'ASCA' | 'ROSCA';
  contribution_amount: number;
  contribution_frequency: 'daily' | 'weekly' | 'monthly';
  meeting_day?: string;
  payout_rotation: unknown[];
  settings: Record<string, unknown>;
  status: 'active' | 'inactive' | 'archived';
  created_at: Date;
  updated_at: Date;
}

export interface GroupMember {
  id: string;
  group_id: string;
  member_id: string;
  joined_at: Date;
  contribution_status: 'current' | 'behind' | 'ahead';
  total_contributed: number;
  metadata: Record<string, unknown>;
}

export interface Payment {
  id: string;
  sacco_id: string;
  member_id?: string;
  group_id?: string;
  amount: number;
  currency: string;
  payment_method?: string;
  reference?: string;
  phone?: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  matched_at?: Date;
  matched_by?: string;
  sms_data?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface AuditLog {
  id: string;
  sacco_id?: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface Notification {
  id: string;
  sacco_id?: string;
  user_id?: string;
  type: string;
  title: string;
  message?: string;
  data: Record<string, unknown>;
  read_at?: Date;
  created_at: Date;
}

// Extended types with relationships
export interface MemberWithGroups extends Member {
  groups?: Group[];
  payments?: Payment[];
}

export interface GroupWithMembers extends Group {
  members?: Member[];
  member_count?: number;
  total_savings?: number;
}
