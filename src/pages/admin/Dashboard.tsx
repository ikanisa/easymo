import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Route, CreditCard, MessageCircle, TrendingUp, ExternalLink, RefreshCw, Info } from "lucide-react";
import { AdminAPI } from "@/lib/api";
import { SUPABASE_LINKS, HAS_SUPABASE_PROJECT } from "@/lib/api-constants";
import type { AdminStats } from "@/lib/types";

export default function Dashboard() {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const { 
    data: stats, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const result = await AdminAPI.getStats();
      setLastRefresh(new Date());
      return result;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const { 
    data: settings 
  } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: AdminAPI.getSettings,
  });

  const handleRefresh = () => {
    refetch();
  };

  const supabaseDisabledMessage = 'Configure VITE_SUPABASE_URL or VITE_SUPABASE_PROJECT_ID to enable Supabase links.';
  const supabaseLinksEnabled = HAS_SUPABASE_PROJECT;
  const openSupabaseLink = (url?: string) => {
    if (!url) return;
    window.open(url, '_blank');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString('en-GB', {
      timeZone: 'Africa/Kigali',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading && !stats) {
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

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="WhatsApp Mobility Platform Overview" />
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load dashboard data: {error instanceof Error ? error.message : 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const cards = stats ? [
    {
      title: "Drivers Online",
      value: stats.drivers_online ?? 0,
      icon: Users,
      description: "Active drivers (last 30min)",
      color: "text-whatsapp",
    },
    {
      title: "Open Trips",
      value: stats.open_passenger_trips ?? stats.open_trips ?? 0,
      icon: Route,
      description: "Pending passenger requests",
      color: "text-info",
    },
    {
      title: "Active Subscriptions", 
      value: stats.active_subscribers ?? stats.active_subscriptions ?? 0,
      icon: CreditCard,
      description: "Paid driver subscriptions",
      color: "text-success",
    },
  ] : [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dashboard" 
        description="WhatsApp Mobility Platform Overview"
        action={{
          label: isLoading ? "Refreshing..." : "Refresh",
          onClick: handleRefresh,
          disabled: isLoading,
          icon: RefreshCw,
        }}
      />

      {/* Launch Mode Banner */}
      {settings && (
        <Alert className={settings.pro_enabled ? "border-success" : "border-info"}>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>
              {settings.pro_enabled 
                ? "Pro tier ACTIVE. Driver-only features gated." 
                : "Launch Mode: All services FREE. Credits not consumed."
              }
            </strong>
            {lastRefresh && (
              <span className="ml-2 text-sm text-muted-foreground">
                • Last updated {formatTime(lastRefresh)}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

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
            {stats && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-success rounded-full"></div>
                    <span className="text-sm">Total Users</span>
                  </div>
                  <span className="text-sm font-medium">{(stats.total_users ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-info rounded-full"></div>
                    <span className="text-sm">Total Trips</span>
                  </div>
                  <span className="text-sm font-medium">{(stats.total_trips ?? stats.open_trips ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-warning rounded-full"></div>
                    <span className="text-sm">Pending Subscriptions</span>
                  </div>
                  <span className="text-sm font-medium">{(stats.pending_subscriptions ?? 0).toLocaleString()}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-success" />
              <span>Quick Links</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!supabaseLinksEnabled && (
              <p className="text-xs text-muted-foreground">
                {supabaseDisabledMessage}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => openSupabaseLink(SUPABASE_LINKS.tables)}
              disabled={!SUPABASE_LINKS.tables}
              title={!SUPABASE_LINKS.tables ? supabaseDisabledMessage : undefined}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              DB → Tables
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => openSupabaseLink(SUPABASE_LINKS.logs)}
              disabled={!SUPABASE_LINKS.logs}
              title={!SUPABASE_LINKS.logs ? supabaseDisabledMessage : undefined}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Logs → Edge Functions
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={() => openSupabaseLink(SUPABASE_LINKS.proofs)}
              disabled={!SUPABASE_LINKS.proofs}
              title={!SUPABASE_LINKS.proofs ? supabaseDisabledMessage : undefined}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Storage → Proofs
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
