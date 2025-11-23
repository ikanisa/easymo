"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { TokenAllocator } from "@/components/features/wallet/TokenAllocator";
import { TransactionTable } from "@/components/features/wallet/TransactionTable";
import { PartnerList } from "@/components/features/wallet/PartnerList";
import { MetricCard } from "@/components/features/dashboard/MetricCard";
import { Wallet, ArrowUpRight, ArrowDownRight, Users } from "lucide-react";

export default function WalletPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wallet & Tokens</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage token distribution, partners, and view transaction history.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Supply"
            value="1,000,000"
            icon={Wallet}
            trend="neutral"
          />
          <MetricCard
            title="Circulating"
            value="450,230"
            change="+5%"
            trend="up"
            icon={Users}
          />
          <MetricCard
            title="Allocated"
            value="120,000"
            change="+12%"
            trend="up"
            icon={ArrowUpRight}
          />
          <MetricCard
            title="Redeemed"
            value="54,320"
            change="-2%"
            trend="down"
            icon={ArrowDownRight}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Allocation & Partners */}
          <div className="space-y-6">
            <TokenAllocator />
            <PartnerList />
          </div>

          {/* Right Column - Transactions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
            </div>
            <TransactionTable />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
