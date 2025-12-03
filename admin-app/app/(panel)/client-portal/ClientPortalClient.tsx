"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { QrCode, History, Users, BarChart3, Settings, User } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import { NfcToggle } from "@/components/client-portal/NfcToggle";
import { AmountInput } from "@/components/client-portal/AmountInput";
import type { SupportedCountryCode } from "@/lib/countries/types";
import {
  COUNTRY_FLAGS,
  COUNTRY_MOMO_BRANDS,
  DEFAULT_COUNTRY_CODE,
} from "@/lib/countries/types";
import { formatCurrencyForCountry } from "@/lib/countries/countries-service";
import {
  useSmsVendorsQuery,
  useVendorStatsQuery,
  useVendorTransactionsQuery,
} from "@/lib/queries/sms-vendors";

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClientPortalClient() {
  // User's mobile money configuration
  // TODO: Fetch from user profile in Supabase
  const [userMomoCountry] = useState<SupportedCountryCode>(DEFAULT_COUNTRY_CODE);
  const [amount, setAmount] = useState(0);
  const [nfcEnabled, setNfcEnabled] = useState(false);

  // Vendor data queries
  const vendorsQuery = useSmsVendorsQuery({ limit: 1, status: "active" });
  const firstVendor = vendorsQuery.data?.data?.[0];
  
  const statsQuery = useVendorStatsQuery(firstVendor?.id ?? "");
  const transactionsQuery = useVendorTransactionsQuery(
    { vendorId: firstVendor?.id ?? "", limit: 5 },
  );

  const stats = statsQuery.data;
  const recentTransactions = transactionsQuery.data?.data ?? [];

  // Calculate today's stats
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayTransactions = recentTransactions.filter(
    (t) => new Date(t.createdAt) >= startOfToday
  );
  const todayRevenue = todayTransactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);

  const handleGenerateQR = () => {
    // TODO: Generate QR code with amount
    console.log("Generate QR for amount:", amount);
  };

  const handleNfcToggle = (enabled: boolean) => {
    setNfcEnabled(enabled);
    // TODO: Initialize NFC writer if enabled
  };

  if (vendorsQuery.isLoading) {
    return (
      <div className="admin-page">
        <LoadingState title="Loading" description="Fetching your data..." />
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Header with Profile Link */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--aurora-text-primary)]">
            {firstVendor ? `Welcome, ${firstVendor.vendorName}` : "Client Portal"}
          </h1>
          <p className="text-sm text-[var(--aurora-text-muted)]">
            {COUNTRY_FLAGS[userMomoCountry]} {COUNTRY_MOMO_BRANDS[userMomoCountry]}
          </p>
        </div>
        <Link href="/client-portal/profile">
          <Button variant="secondary" size="sm">
            <User className="w-4 h-4 mr-1" />
            Profile
          </Button>
        </Link>
      </div>

      {/* NFC Toggle */}
      <div className="mb-6">
        <NfcToggle onToggle={handleNfcToggle} defaultEnabled={nfcEnabled} />
      </div>

      {/* Amount Input with Dynamic Keyboard */}
      <div className="mb-6">
        <AmountInput
          countryCode={userMomoCountry}
          onAmountChange={setAmount}
          initialAmount={0}
        />
      </div>

      {/* Generate QR Button */}
      <Button
        variant="primary"
        onClick={handleGenerateQR}
        disabled={amount === 0}
        className="w-full mb-6"
      >
        <QrCode className="w-5 h-5 mr-2" />
        Generate QR Code
      </Button>

      {/* Today's Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-xs text-[var(--aurora-text-muted)]">Today</p>
          <p className="text-xl font-bold text-[var(--aurora-text-primary)]">
            {formatCurrencyForCountry(todayRevenue, userMomoCountry)}
          </p>
          <p className="text-xs text-[var(--aurora-text-muted)]">
            {todayTransactions.length} transactions
          </p>
        </div>
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-4">
          <p className="text-xs text-[var(--aurora-text-muted)]">This Month</p>
          <p className="text-xl font-bold text-[var(--aurora-text-primary)]">
            {formatCurrencyForCountry(stats?.thisMonthRevenue ?? 0, userMomoCountry)}
          </p>
          <p className="text-xs text-[var(--aurora-text-muted)]">
            {stats?.thisMonthTransactions ?? 0} transactions
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <Link href="/client-portal/transactions" className="block">
          <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-3 text-center hover:bg-[var(--aurora-surface-elevated)] transition-colors">
            <History className="w-5 h-5 mx-auto mb-1 text-[var(--aurora-accent)]" />
            <p className="text-xs text-[var(--aurora-text-secondary)]">History</p>
          </div>
        </Link>
        <Link href="/client-portal/payers" className="block">
          <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-3 text-center hover:bg-[var(--aurora-surface-elevated)] transition-colors">
            <Users className="w-5 h-5 mx-auto mb-1 text-[var(--aurora-accent)]" />
            <p className="text-xs text-[var(--aurora-text-secondary)]">Payers</p>
          </div>
        </Link>
        <Link href="/client-portal/reports" className="block">
          <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-3 text-center hover:bg-[var(--aurora-surface-elevated)] transition-colors">
            <BarChart3 className="w-5 h-5 mx-auto mb-1 text-[var(--aurora-accent)]" />
            <p className="text-xs text-[var(--aurora-text-secondary)]">Reports</p>
          </div>
        </Link>
        <Link href="/client-portal/settings" className="block">
          <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-3 text-center hover:bg-[var(--aurora-surface-elevated)] transition-colors">
            <Settings className="w-5 h-5 mx-auto mb-1 text-[var(--aurora-accent)]" />
            <p className="text-xs text-[var(--aurora-text-secondary)]">Settings</p>
          </div>
        </Link>
      </div>

      {/* Recent Transactions */}
      <SectionCard
        title="Recent Transactions"
        description="Your latest payments"
        actions={
          <Link href="/client-portal/transactions">
            <Button variant="secondary" size="sm">
              View All
            </Button>
          </Link>
        }
      >
        {transactionsQuery.isLoading ? (
          <LoadingState title="Loading transactions" />
        ) : recentTransactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Transactions will appear here once you start receiving payments."
          />
        ) : (
          <div className="space-y-3">
            {recentTransactions.slice(0, 5).map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between p-3 bg-[var(--aurora-surface-elevated)] rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--aurora-text-primary)]">
                    {txn.payerName || "Unknown"}
                  </p>
                  <p className="text-xs text-[var(--aurora-text-muted)]">
                    {formatDate(txn.createdAt)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[var(--aurora-text-primary)]">
                  {txn.amount !== null
                    ? formatCurrencyForCountry(txn.amount, userMomoCountry)
                    : "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
