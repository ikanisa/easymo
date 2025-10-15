/**
 * Operations & Health Page
 * Edge Functions health, cron jobs, storage status and operational deep links
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  ExternalLink, 
  Clock, 
  Database, 
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { AdminAPI, type HealthCheckResult } from '@/lib/api';
import { SUPABASE_LINKS, HAS_SUPABASE_PROJECT } from '@/lib/api-constants';

const EDGE_FUNCTIONS = [
  { name: 'wa-webhook', description: 'WhatsApp webhook handler' },
  { name: 'admin-settings', description: 'Settings management' },
  { name: 'admin-stats', description: 'Dashboard metrics' },
  { name: 'admin-users', description: 'User data' },
  { name: 'admin-trips', description: 'Trip operations' },
  { name: 'admin-subscriptions', description: 'Subscription management' },
  { name: 'media-fetch', description: 'WhatsApp media ingestion' },
  { name: 'housekeeping', description: 'Scheduled cleanup tasks' },
];

export default function Operations() {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const { data: healthData, isLoading, refetch } = useQuery<HealthCheckResult>({
    queryKey: ['health-check'],
    queryFn: async () => {
      const result = await AdminAPI.healthCheck();
      setLastRefresh(new Date());
      return result;
    },
    refetchInterval: 60000, // Check every minute
    retry: false,
    refetchOnWindowFocus: false,
  });

  const handleRefresh = () => {
    refetch();
  };

  const isError = healthData?.status === 'error';
  const isSuccess = healthData?.status === 'ok';
  const supabaseDisabledMessage = 'Configure VITE_SUPABASE_URL or VITE_SUPABASE_PROJECT_ID to enable Supabase links.';
  const supabaseLinksEnabled = HAS_SUPABASE_PROJECT;
  const showSupabaseWarning = !supabaseLinksEnabled;
  const openSupabaseLink = (url?: string) => {
    if (!url) return;
    window.open(url, '_blank');
  };
  const functionsBase = SUPABASE_LINKS.functions;

  const formatTime = (date: Date) => {
    return date.toLocaleString('en-GB', {
      timeZone: 'Africa/Kigali',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="Operations & Health"
          description="Edge Functions health, scheduled tasks, and storage status"
          action={{
            label: isLoading ? "Checking..." : "Refresh",
            onClick: handleRefresh,
            disabled: isLoading,
            icon: RefreshCw,
          }}
        />

        {/* Health Status */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>System Health</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">API Status</span>
                {isError ? (
                  <Badge variant="destructive" className="flex items-center space-x-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Error</span>
                  </Badge>
                ) : isLoading ? (
                  <Badge variant="secondary">Checking...</Badge>
                ) : (
                  <Badge
                    variant={isSuccess ? "default" : "secondary"}
                    className={`flex items-center space-x-1 ${isSuccess ? 'bg-success text-success-foreground' : ''}`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{isSuccess ? 'Online' : 'Not Tested'}</span>
                  </Badge>
                )}
              </div>

              {healthData && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Response Time</span>
                    <span className="text-sm font-mono">{healthData.round_trip_ms}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Last Check</span>
                    <span className="text-sm font-mono">
                      {lastRefresh ? formatTime(lastRefresh) : 'Never'}
                    </span>
                  </div>
                  {healthData.fallback && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Fallback Probe</span>
                      <span className="font-mono">
                        {healthData.fallback.status === 'ok'
                          ? `OK (${healthData.fallback.round_trip_ms}ms)`
                          : `Error${healthData.fallback.message ? `: ${healthData.fallback.message}` : ''}`}
                      </span>
                    </div>
                  )}
                </>
              )}

              {isError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {healthData?.message ?? 'Unknown error occurred'}
                    {healthData?.fallback && healthData.fallback.status !== 'ok' && (
                      <span className="mt-2 block text-xs text-muted-foreground">
                        Fallback: {healthData.fallback.message ?? 'Unavailable'}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Scheduled Tasks</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Housekeeping</strong> runs hourly to:
                  <ul className="mt-2 ml-4 space-y-1 text-sm">
                    <li>• Mark drivers offline after 30 minutes</li>
                    <li>• Expire trips after 24 hours</li>
                    <li>• Expire subscriptions by expires_at</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {showSupabaseWarning && (
                <p className="text-xs text-muted-foreground">
                  {supabaseDisabledMessage}
                </p>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => openSupabaseLink(SUPABASE_LINKS.cron)}
                disabled={!SUPABASE_LINKS.cron}
                title={!SUPABASE_LINKS.cron ? supabaseDisabledMessage : undefined}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Cron Jobs
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Edge Functions Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Edge Functions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {showSupabaseWarning && (
              <p className="mb-3 text-xs text-muted-foreground">
                {supabaseDisabledMessage}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {EDGE_FUNCTIONS.map((func) => (
                <div
                  key={func.name}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <h4 className="font-medium text-sm">{func.name}</h4>
                    <p className="text-xs text-muted-foreground">{func.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openSupabaseLink(functionsBase ? `${functionsBase}/${func.name}/logs` : undefined)}
                    disabled={!functionsBase}
                    title={!functionsBase ? supabaseDisabledMessage : undefined}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => openSupabaseLink(SUPABASE_LINKS.functions)}
                disabled={!SUPABASE_LINKS.functions}
                title={!SUPABASE_LINKS.functions ? supabaseDisabledMessage : undefined}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View All Functions
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Storage Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <HardDrive className="h-5 w-5" />
              <span>Storage</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Bucket "proofs":</strong> Private storage for subscription proof images.
                Signed URLs generated via admin endpoints for review access.
              </AlertDescription>
            </Alert>

            {showSupabaseWarning && (
              <p className="text-xs text-muted-foreground">
                {supabaseDisabledMessage}
              </p>
            )}

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => openSupabaseLink(SUPABASE_LINKS.proofs)}
                disabled={!SUPABASE_LINKS.proofs}
                title={!SUPABASE_LINKS.proofs ? supabaseDisabledMessage : undefined}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Browse Proofs
              </Button>

              <Button
                variant="outline"
                onClick={() => openSupabaseLink(SUPABASE_LINKS.storage)}
                disabled={!SUPABASE_LINKS.storage}
                title={!SUPABASE_LINKS.storage ? supabaseDisabledMessage : undefined}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                All Storage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}