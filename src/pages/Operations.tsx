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
import { AdminAPI } from '@/lib/api';
import { SUPABASE_LINKS } from '@/lib/api-constants';

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

  const { data: healthData, isLoading, error, refetch } = useQuery({
    queryKey: ['health-check'],
    queryFn: async () => {
      const result = await AdminAPI.healthCheck();
      setLastRefresh(new Date());
      return result;
    },
    refetchInterval: 60000, // Check every minute
  });

  const handleRefresh = () => {
    refetch();
  };

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
                {error ? (
                  <Badge variant="destructive" className="flex items-center space-x-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Error</span>
                  </Badge>
                ) : isLoading ? (
                  <Badge variant="secondary">Checking...</Badge>
                ) : (
                  <Badge variant="default" className="bg-success text-success-foreground flex items-center space-x-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Online</span>
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
                </>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {error instanceof Error ? error.message : 'Unknown error occurred'}
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
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => window.open(SUPABASE_LINKS.cron, '_blank')}
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
                    onClick={() => window.open(`${SUPABASE_LINKS.functions}/${func.name}/logs`, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => window.open(SUPABASE_LINKS.functions, '_blank')}
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

            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => window.open(SUPABASE_LINKS.proofs, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Browse Proofs
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => window.open(SUPABASE_LINKS.storage, '_blank')}
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