"use client";

import { motion } from "framer-motion";
import { 
  Users, 
  DollarSign, 
  MessageCircle, 
  TrendingUp,
  Download,
  Plus,
  AlertCircle
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { KpiCard } from "@/components/data-display/KpiCard";
import { Card } from "@/components/data-display/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Spinner } from "@/components/feedback/Spinner";
import { Skeleton } from "@/components/feedback/Skeleton";
import { IntegrationHealthWidget } from "@/components/dashboard/IntegrationHealthWidget";
import { PaymentsHealthWidget } from "@/components/dashboard/PaymentsHealthWidget";
import { AdminDiagnosticsCard } from "@/components/dashboard/AdminDiagnosticsCard";
import { AdminHubSectionGrid } from "@/components/dashboard/AdminHubSectionGrid";
import { WebhookErrorList } from "@/components/whatsapp/WebhookErrorList";
import { useAdminHubSnapshotQuery } from "@/lib/queries/adminHub";
import {
  useDashboardSnapshotQuery,
  useDashboardWebhookErrorsQuery,
} from "@/lib/queries/dashboard";

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const listItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  },
};

export function AuroraDashboardClient() {
  const snapshotQuery = useDashboardSnapshotQuery();
  const webhookErrorsQuery = useDashboardWebhookErrorsQuery();
  const adminHubQuery = useAdminHubSnapshotQuery();

  if (snapshotQuery.isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Spinner size="lg" />
          <div>
            <h3 className="text-lg font-semibold text-aurora-text-primary">Loading dashboard</h3>
            <p className="text-sm text-aurora-text-muted">Fetching the latest KPIs and service telemetry...</p>
          </div>
        </div>
      </div>
    );
  }

  const snapshotResult = snapshotQuery.data;
  const snapshot = snapshotResult?.data ?? { kpis: [], timeseries: [] };
  const webhookErrors = webhookErrorsQuery.data ?? [];
  const adminHub = adminHubQuery.data;
  const integrationNotice = snapshotResult?.integration;
  
  const dashboardDescription = integrationNotice?.status === "degraded"
    ? "Live KPIs are unavailable until Supabase credentials are configured."
    : "Welcome back! Here's what's happening with your platform.";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        description={dashboardDescription}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" leftIcon={<Download className="w-4 h-4" />}>
              Export
            </Button>
            <Button leftIcon={<Plus className="w-4 h-4" />}>
              New Report
            </Button>
          </div>
        }
      />

      {/* Integration Warning */}
      {integrationNotice?.status === "degraded" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-aurora-warning/30 bg-aurora-warning-subtle 
                     px-5 py-4 flex items-start gap-3"
          role="status"
          aria-live="polite"
        >
          <AlertCircle className="w-5 h-5 text-aurora-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-aurora-text-primary">Dashboard is using fallback data.</p>
            {integrationNotice.message && (
              <p className="mt-1 text-aurora-text-secondary">{integrationNotice.message}</p>
            )}
            {integrationNotice.remediation && (
              <p className="mt-2 font-medium text-aurora-text-primary">
                Remediation: {integrationNotice.remediation}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* KPI Grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {snapshot.kpis.length > 0 ? (
          snapshot.kpis.slice(0, 4).map((kpi, index) => (
            <motion.div key={index} variants={listItem}>
              <KpiCard
                title={kpi.label}
                value={kpi.primaryValue}
                change={kpi.secondaryValue ? parseFloat(kpi.secondaryValue) : undefined}
                trend={kpi.trend === 'flat' ? 'neutral' : kpi.trend === null ? undefined : kpi.trend}
                changeLabel={kpi.helpText}
                icon={getKpiIcon(kpi.label)}
              />
            </motion.div>
          ))
        ) : (
          <>
            {[1, 2, 3, 4].map((i) => (
              <motion.div key={i} variants={listItem}>
                <Card className="p-5">
                  <Skeleton className="h-4 w-24 mb-3" />
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </Card>
              </motion.div>
            ))}
          </>
        )}
      </motion.div>

      {/* Quick Actions */}
      {adminHub && (
        <Card>
          <div className="p-6 border-b border-aurora-border">
            <h2 className="text-lg font-semibold text-aurora-text-primary">Quick Actions</h2>
            <p className="text-sm text-aurora-text-muted mt-1">
              Access key administrative tools and system diagnostics
            </p>
          </div>
          <div className="p-6">
            <AdminHubSectionGrid
              sections={adminHub.sections}
              messages={adminHub.messages}
            />
          </div>
        </Card>
      )}

      {/* System Health Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IntegrationHealthWidget />
        <PaymentsHealthWidget />
      </div>

      {/* Diagnostics */}
      <AdminDiagnosticsCard />

      {/* Webhook Errors */}
      {webhookErrors.length > 0 && (
        <Card>
          <div className="p-6 border-b border-aurora-border">
            <h2 className="text-lg font-semibold text-aurora-text-primary">Recent Webhook Errors</h2>
            <p className="text-sm text-aurora-text-muted mt-1">
              Latest WhatsApp webhook processing errors
            </p>
          </div>
          <div className="p-6">
            <WebhookErrorList errors={webhookErrors.slice(0, 10)} />
          </div>
        </Card>
      )}
    </div>
  );
}

function getKpiIcon(label: string) {
  const iconMap: Record<string, any> = {
    'Active Users': <Users className="w-5 h-5" />,
    'Users': <Users className="w-5 h-5" />,
    'Revenue': <DollarSign className="w-5 h-5" />,
    'Messages': <MessageCircle className="w-5 h-5" />,
    'Conversion': <TrendingUp className="w-5 h-5" />,
  };

  return iconMap[label] || <TrendingUp className="w-5 h-5" />;
}
