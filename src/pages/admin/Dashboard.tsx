import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Route, CreditCard, MessageCircle, TrendingUp } from "lucide-react";
import { ADAPTER } from "@/lib/adapter";
import type { AdminStats } from "@/lib/types";

export default function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadStats() {
    try {
      setLoading(true);
      const data = await ADAPTER.getAdminStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="WhatsApp Mobility Platform Overview" />
        
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-20 bg-muted rounded"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded mb-1"></div>
                <div className="h-3 w-24 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Drivers Online",
      value: stats.drivers_online,
      icon: Users,
      description: "Active drivers (last 30min)",
      color: "text-whatsapp",
    },
    {
      title: "Open Trips",
      value: stats.open_passenger_trips,
      icon: Route,
      description: "Pending passenger requests",
      color: "text-info",
    },
    {
      title: "Active Subscriptions", 
      value: stats.active_subscribers,
      icon: CreditCard,
      description: "Paid driver subscriptions",
      color: "text-success",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="WhatsApp Mobility Platform Overview" />

      <div className="grid gap-6 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5 text-whatsapp" />
              <span>Platform Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-success rounded-full"></div>
                <span className="text-sm">Total Users</span>
              </div>
              <span className="text-sm font-medium">{stats.total_users}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-info rounded-full"></div>
                <span className="text-sm">Total Trips</span>
              </div>
              <span className="text-sm font-medium">{stats.total_trips}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-warning rounded-full"></div>
                <span className="text-sm">Pending Subscriptions</span>
              </div>
              <span className="text-sm font-medium">{stats.pending_subscriptions}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-success" />
              <span>System Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-success rounded-full"></div>
                <span className="text-sm">Mock Adapter</span>
              </div>
              <span className="text-xs text-success font-medium">Phase-1 Ready</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-info rounded-full"></div>
                <span className="text-sm">Local Storage</span>
              </div>
              <span className="text-xs text-success font-medium">Persisting</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-warning rounded-full"></div>
                <span className="text-sm">WhatsApp Webhook</span>
              </div>
              <span className="text-xs text-warning font-medium">Phase-2</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-warning rounded-full"></div>
                <span className="text-sm">Supabase Backend</span>
              </div>
              <span className="text-xs text-warning font-medium">Phase-2</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}