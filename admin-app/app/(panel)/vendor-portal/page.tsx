'use client';

/**
 * Vendor Portal Dashboard Page
 * Main entry point with stats, chart, and recent transactions
 */

import { 
  RecentTransactions, 
  RevenueChart, 
  StatsGrid 
} from '@/components/vendor-portal/dashboard';
import { PortalShell } from '@/components/vendor-portal/layout';
import { 
  mockDashboardStats, 
  mockRevenueData, 
  mockTransactions 
} from '@/lib/vendor-portal/mock-data';

export default function VendorPortalDashboard() {
  return (
    <PortalShell title="Vendor Portal">
      <div className="space-y-6">
        {/* Stats Grid */}
        <StatsGrid stats={mockDashboardStats} />
        
        {/* Revenue Chart */}
        <RevenueChart data={mockRevenueData} />
        
        {/* Recent Transactions */}
        <RecentTransactions transactions={mockTransactions} />
      </div>
    </PortalShell>
  );
}
