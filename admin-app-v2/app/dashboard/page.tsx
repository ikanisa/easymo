"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/features/dashboard/MetricCard";
import { ActivityFeed } from "@/components/features/dashboard/ActivityFeed";
import { Users, DollarSign, Activity, Shield } from "lucide-react";

const metrics = [
  {
    title: "Total Users",
    value: "12,345",
    change: "+12% from last month",
    trend: "up" as const,
    icon: Users,
  },
  {
    title: "Total Revenue",
    value: "$45,231",
    change: "+20% from last month",
    trend: "up" as const,
    icon: DollarSign,
  },
  {
    title: "Active Sessions",
    value: "1,234",
    change: "+5% from last hour",
    trend: "up" as const,
    icon: Activity,
  },
  {
    title: "Active Policies",
    value: "567",
    change: "-2% from last month",
    trend: "down" as const,
    icon: Shield,
  },
];

const activities = [
  {
    id: "1",
    user: { name: "John Doe" },
    action: "purchased insurance",
    target: "Policy #12345",
    timestamp: "2m ago",
  },
  {
    id: "2",
    user: { name: "Jane Smith" },
    action: "registered new wallet",
    target: "Wallet #67890",
    timestamp: "15m ago",
  },
  {
    id: "3",
    user: { name: "Alice Johnson" },
    action: "updated profile",
    target: "Settings",
    timestamp: "1h ago",
  },
];

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of system performance and key metrics.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ActivityFeed activities={activities} />
          {/* Placeholder for another widget, e.g., Recent Users or System Status */}
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
            <p className="mt-4 text-gray-500">System health monitoring will be displayed here.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
