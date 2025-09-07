import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Subscription } from "@/lib/types";

interface StatsCardsProps {
  subscriptions: Subscription[];
}

export function StatsCards({ subscriptions }: StatsCardsProps) {
  const stats = {
    pending: subscriptions.filter(s => s.status === "pending_review").length,
    active: subscriptions.filter(s => s.status === "active").length,
    expired: subscriptions.filter(s => s.status === "expired").length,
    revenue: subscriptions.filter(s => s.status === "active").length * 5000,
  };

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-warning">
            {stats.pending}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Active</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success">
            {stats.active}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Expired</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-muted-foreground">
            {stats.expired}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.revenue.toLocaleString()} RWF
          </div>
        </CardContent>
      </Card>
    </div>
  );
}