"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Chart } from "@/components/features/analytics/Chart";
import { InsightCard } from "@/components/features/analytics/InsightCard";
import { Button } from "@/components/ui/Button";
import { Download } from "lucide-react";

const revenueData = [
  { month: "Jan", value: 4000 },
  { month: "Feb", value: 3000 },
  { month: "Mar", value: 2000 },
  { month: "Apr", value: 2780 },
  { month: "May", value: 1890 },
  { month: "Jun", value: 2390 },
  { month: "Jul", value: 3490 },
];

const userData = [
  { day: "Mon", value: 120 },
  { day: "Tue", value: 132 },
  { day: "Wed", value: 101 },
  { day: "Thu", value: 134 },
  { day: "Fri", value: 90 },
  { day: "Sat", value: 230 },
  { day: "Sun", value: 210 },
];

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="mt-1 text-sm text-gray-500">
              Detailed insights into system performance and user behavior.
            </p>
          </div>
          <Button variant="secondary">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <InsightCard
            title="Total Revenue"
            value="$45,231"
            change="+20.1%"
            trend="up"
            description="Compared to last month"
          />
          <InsightCard
            title="Active Users"
            value="2,345"
            change="+15.2%"
            trend="up"
            description="Compared to last month"
          />
          <InsightCard
            title="Bounce Rate"
            value="42.3%"
            change="-5.4%"
            trend="down"
            description="Compared to last month"
          />
          <InsightCard
            title="Avg. Session"
            value="4m 32s"
            change="+1.2%"
            trend="neutral"
            description="Compared to last month"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Chart
            title="Revenue Overview"
            data={revenueData}
            type="line"
            dataKey="value"
            category="month"
          />
          <Chart
            title="User Activity"
            data={userData}
            type="bar"
            dataKey="value"
            category="day"
            color="#10b981"
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
