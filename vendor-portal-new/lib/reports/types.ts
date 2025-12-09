export interface ReportSummary {
  totals: {
    rangeDeposits: number;
    today: number;
    week: number;
    month: number;
  };
  counts: {
    activeIbimina: number;
    activeMembers: number;
    unallocated: number;
    exceptions: number;
  };
  contributionsByDay: Array<{ date: string; amount: number }>;
  topIkimina: Array<{ id: string; name: string; code: string; amount: number }>;
  recentPayments: Array<{
    id: string;
    txn_id: string | null;
    reference: string | null;
    amount: number;
    occurred_at: string;
    status: string;
    ikimina: { name: string | null } | null;
  }>;
}

export interface ReportFiltersState {
  saccoId?: string | null;
  district?: string | null;
  startDate: string;
  endDate: string;
}
