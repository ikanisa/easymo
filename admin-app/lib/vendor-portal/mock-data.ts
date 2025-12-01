/**
 * Vendor Portal Mock Data
 * Sample data for development and testing
 */

import type { 
  DashboardStats, 
  Payer, 
  ReportSummary, 
  RevenueDataPoint, 
  Transaction 
} from './types';

// Helper to generate initials from name
function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return 'XX';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// Mock transactions
export const mockTransactions: Transaction[] = [
  {
    id: 'txn-001',
    payerName: 'John Doe',
    payerPhone: '+250 788 123 456',
    amount: 15000,
    currency: 'RWF',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    status: 'completed',
    reference: 'TXN001234',
  },
  {
    id: 'txn-002',
    payerName: 'Marie Claire',
    payerPhone: '+250 788 456 789',
    amount: 8500,
    currency: 'RWF',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    status: 'completed',
    reference: 'TXN001235',
  },
  {
    id: 'txn-003',
    payerName: 'Peter Mukiza',
    payerPhone: '+250 788 111 222',
    amount: 25000,
    currency: 'RWF',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    status: 'completed',
    reference: 'TXN001236',
  },
  {
    id: 'txn-004',
    payerName: 'Alice Uwimana',
    payerPhone: '+250 788 333 444',
    amount: 12000,
    currency: 'RWF',
    timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000), // Yesterday
    status: 'completed',
    reference: 'TXN001237',
  },
  {
    id: 'txn-005',
    payerName: 'Emmanuel Niyonzima',
    payerPhone: '+250 788 555 666',
    amount: 35000,
    currency: 'RWF',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
    status: 'completed',
    reference: 'TXN001238',
  },
  {
    id: 'txn-006',
    payerName: 'Grace Mutoni',
    payerPhone: '+250 788 777 888',
    amount: 18500,
    currency: 'RWF',
    timestamp: new Date(Date.now() - 50 * 60 * 60 * 1000), // 2 days ago
    status: 'completed',
    reference: 'TXN001239',
  },
  {
    id: 'txn-007',
    payerName: 'Patrick Habimana',
    payerPhone: '+250 788 999 000',
    amount: 42000,
    currency: 'RWF',
    timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000), // 3 days ago
    status: 'completed',
    reference: 'TXN001240',
  },
  {
    id: 'txn-008',
    payerName: 'Diane Ishimwe',
    payerPhone: '+250 788 222 333',
    amount: 9800,
    currency: 'RWF',
    timestamp: new Date(Date.now() - 96 * 60 * 60 * 1000), // 4 days ago
    status: 'completed',
    reference: 'TXN001241',
  },
];

// Mock payers
export const mockPayers: Payer[] = [
  {
    id: 'payer-001',
    name: 'John Doe',
    phone: '+250 788 123 456',
    totalPaid: 450000,
    currency: 'RWF',
    transactionCount: 12,
    lastPaymentDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
    initials: 'JD',
  },
  {
    id: 'payer-002',
    name: 'Marie Claire',
    phone: '+250 788 456 789',
    totalPaid: 320000,
    currency: 'RWF',
    transactionCount: 8,
    lastPaymentDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    initials: 'MC',
  },
  {
    id: 'payer-003',
    name: 'Peter Mukiza',
    phone: '+250 788 111 222',
    totalPaid: 275000,
    currency: 'RWF',
    transactionCount: 6,
    lastPaymentDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    initials: 'PM',
  },
  {
    id: 'payer-004',
    name: 'Alice Uwimana',
    phone: '+250 788 333 444',
    totalPaid: 180000,
    currency: 'RWF',
    transactionCount: 5,
    lastPaymentDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
    initials: 'AU',
  },
  {
    id: 'payer-005',
    name: 'Emmanuel Niyonzima',
    phone: '+250 788 555 666',
    totalPaid: 145000,
    currency: 'RWF',
    transactionCount: 4,
    lastPaymentDate: new Date(Date.now() - 72 * 60 * 60 * 1000),
    initials: 'EN',
  },
];

// Mock dashboard stats
export const mockDashboardStats: DashboardStats = {
  today: {
    amount: 125000,
    currency: 'RWF',
    change: 12,
    changeType: 'positive',
  },
  thisWeek: {
    amount: 890000,
    currency: 'RWF',
    transactionCount: 15,
  },
  uniquePayers: {
    count: 23,
    newThisWeek: 5,
  },
  thisMonth: {
    amount: 3200000,
    currency: 'RWF',
    transactionCount: 67,
  },
};

// Mock revenue chart data (last 7 days)
export const mockRevenueData: RevenueDataPoint[] = [
  { day: 'mon', amount: 85000, label: 'Mon' },
  { day: 'tue', amount: 120000, label: 'Tue' },
  { day: 'wed', amount: 175000, label: 'Wed' },
  { day: 'thu', amount: 225000, label: 'Thu' },
  { day: 'fri', amount: 160000, label: 'Fri' },
  { day: 'sat', amount: 95000, label: 'Sat' },
  { day: 'sun', amount: 130000, label: 'Sun' },
];

// Mock report summary
export const mockReportSummary: ReportSummary = {
  totalRevenue: 1250000,
  currency: 'RWF',
  transactionCount: 45,
  uniquePayers: 18,
  averageTransaction: 27778,
  period: 'week',
};

// Helper function to format currency
export function formatCurrency(amount: number, currency: string = 'RWF'): string {
  if (currency === 'RWF') {
    return `RWF ${amount.toLocaleString()}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Helper function to format relative time
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Helper function to format time
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Group transactions by date
export function groupTransactionsByDate(transactions: Transaction[]): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  transactions.forEach(txn => {
    const txnDate = new Date(txn.timestamp);
    txnDate.setHours(0, 0, 0, 0);

    let dateKey: string;
    if (txnDate.getTime() === today.getTime()) {
      dateKey = 'Today';
    } else if (txnDate.getTime() === yesterday.getTime()) {
      dateKey = 'Yesterday';
    } else {
      dateKey = txnDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(txn);
  });

  return groups;
}
