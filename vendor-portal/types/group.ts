// ═══════════════════════════════════════════════════════════════════════════
// Group (Ikimina) Types
// Description: TypeScript types for SACCO groups/savings circles
// ═══════════════════════════════════════════════════════════════════════════

export type GroupType = "ASCA" | "ROSCA" | "VSLA" | "SACCO";

export type GroupStatus = "ACTIVE" | "INACTIVE" | "DISSOLVED";

export type MeetingFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

// ─────────────────────────────────────────────────────────────────────────────
// Core Group Entity
// ─────────────────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  sacco_id: string;
  name: string;
  code: string;
  type: GroupType;
  description: string | null;
  meeting_frequency: MeetingFrequency;
  meeting_day: number | null; // 0-6 for day of week (0=Sunday)
  contribution_amount: number | null;
  currency: string;
  status: GroupStatus;
  start_date: string | null; // ISO date string
  end_date: string | null; // ISO date string
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Group with Statistics
// ─────────────────────────────────────────────────────────────────────────────

export interface GroupWithStats extends Group {
  member_count: number;
  total_savings: number;
  active_members: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Member Statistics (from get_group_member_stats function)
// ─────────────────────────────────────────────────────────────────────────────

export interface GroupMemberStats {
  total_members: number;
  active_members: number;
  inactive_members: number;
  total_savings: number;
  average_savings: number;
  total_payments_30d: number;
  top_savers: Array<{
    member_id: string;
    full_name: string;
    balance: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form Input Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateGroupInput {
  sacco_id: string;
  name: string;
  type: GroupType;
  description?: string;
  meeting_frequency: MeetingFrequency;
  meeting_day?: number;
  contribution_amount?: number;
  currency?: string;
  start_date?: string; // ISO date string
  metadata?: Record<string, unknown>;
}

export interface UpdateGroupInput {
  name?: string;
  type?: GroupType;
  description?: string;
  meeting_frequency?: MeetingFrequency;
  meeting_day?: number;
  contribution_amount?: number;
  status?: GroupStatus;
  end_date?: string; // ISO date string
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Response Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GroupListResponse {
  data: GroupWithStats[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface GroupDetailResponse {
  group: Group;
  stats: GroupMemberStats;
  members: Array<{
    id: string;
    member_code: string;
    full_name: string;
    balance: number;
    status: string;
  }>;
}
