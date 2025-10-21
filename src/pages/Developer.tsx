/**
 * Developer / Connectivity Page
 * API configuration, health checks, and development utilities
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Code2, 
  Settings2, 
  Activity,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Database,
  Eye,
  EyeOff
} from 'lucide-react';
import { AdminAPI, type HealthCheckResult } from '@/lib/api';
import { API_BASE, SUPABASE_LINKS, HAS_SUPABASE_PROJECT } from '@/lib/api-constants';
import { getAdminToken, isDev, shouldUseMock } from '@/lib/env';
import { useToast } from '@/hooks/use-toast';
import { RetrievalPlayground } from '@/components/developer/RetrievalPlayground';

export default function Developer() {
  const [showToken, setShowToken] = useState(false);
  const { toast } = useToast();

  const { data: healthData, isLoading, refetch } = useQuery<HealthCheckResult>({
    queryKey: ['dev-health-check'],
    queryFn: AdminAPI.healthCheck,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const envAdminToken = import.meta.env.VITE_ADMIN_TOKEN?.trim();
  const storedAdminToken = typeof window !== 'undefined' ? window.localStorage.getItem('admin_token') : null;
  const hasCustomToken = Boolean(envAdminToken || storedAdminToken);
  const adminToken = hasCustomToken ? getAdminToken() : '';
  const tokenHint = hasCustomToken
    ? envAdminToken
      ? 'Loaded from VITE_ADMIN_TOKEN'
      : 'Loaded from browser storage'
    : 'Using fallback demo token. Set VITE_ADMIN_TOKEN for production environments.';
  const useMock = shouldUseMock();
  const devMode = isDev();
  const supabaseDisabledMessage = 'Configure VITE_SUPABASE_URL or VITE_SUPABASE_PROJECT_ID to enable these links.';
  const isError = healthData?.status === 'error';
  const isSuccess = healthData?.status === 'ok';

  const openSupabaseLink = (url?: string) => {
    if (!url) return;
    window.open(url, '_blank');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    });
  };

  const handleHealthCheck = () => {
    refetch();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="Developer & Connectivity"
          description="API configuration, health checks, and development utilities"
        />

        {/* Environment Configuration */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings2 className="h-5 w-5" />
                <span>Environment</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">API Base URL</Label>
                <div className="flex items-center space-x-2">
                  <Input 
                    value={API_BASE} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(API_BASE, 'API Base URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Admin Token</Label>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Input 
                      type={showToken ? 'text' : 'password'}
                      value={adminToken || 'Not set'}
                      readOnly 
                      className="font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(adminToken, 'Admin Token')}
                    disabled={!adminToken}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tokenHint}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Mode</Label>
                  <Badge variant={devMode ? "default" : "secondary"}>
                    {devMode ? "Development" : "Production"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data Source</Label>
                  <Badge variant={useMock ? "outline" : "default"}>
                    {useMock ? "Mock API" : "Real API"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>API Health</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Connection Status</span>
                {isError ? (
                  <Badge variant="destructive" className="flex items-center space-x-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Error</span>
                  </Badge>
                ) : isLoading ? (
                  <Badge variant="secondary">Testing...</Badge>
                ) : (
                  <Badge
                    variant={isSuccess ? "default" : "secondary"}
                    className={`flex items-center space-x-1 ${isSuccess ? 'bg-success text-success-foreground' : ''}`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{isSuccess ? 'Connected' : 'Not Tested'}</span>
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
                      {new Date(healthData.timestamp).toLocaleString('en-GB', {
                        timeZone: 'Africa/Kigali',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
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
                    {healthData?.message ?? 'Connection test failed'}
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleHealthCheck}
                disabled={isLoading}
                size="sm"
                className="w-full"
              >
                <Zap className="h-4 w-4 mr-2" />
                {isLoading ? "Testing..." : "Test Connection"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Deep Links & Documentation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Supabase Deep Links</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!HAS_SUPABASE_PROJECT && (
              <p className="mb-3 text-xs text-muted-foreground">
                {supabaseDisabledMessage}
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Button
                variant="outline"
                onClick={() => openSupabaseLink(SUPABASE_LINKS.dashboard)}
                className="justify-start"
                disabled={!SUPABASE_LINKS.dashboard}
                title={!SUPABASE_LINKS.dashboard ? supabaseDisabledMessage : undefined}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Dashboard
              </Button>

              <Button
                variant="outline"
                onClick={() => openSupabaseLink(SUPABASE_LINKS.tables)}
                className="justify-start"
                disabled={!SUPABASE_LINKS.tables}
                title={!SUPABASE_LINKS.tables ? supabaseDisabledMessage : undefined}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Table Editor
              </Button>

              <Button
                variant="outline"
                onClick={() => openSupabaseLink(SUPABASE_LINKS.functions)}
                className="justify-start"
                disabled={!SUPABASE_LINKS.functions}
                title={!SUPABASE_LINKS.functions ? supabaseDisabledMessage : undefined}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Edge Functions
              </Button>

              <Button
                variant="outline"
                onClick={() => openSupabaseLink(SUPABASE_LINKS.storage)}
                className="justify-start"
                disabled={!SUPABASE_LINKS.storage}
                title={!SUPABASE_LINKS.storage ? supabaseDisabledMessage : undefined}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Storage
              </Button>

              <Button
                variant="outline"
                onClick={() => openSupabaseLink(SUPABASE_LINKS.logs)}
                className="justify-start"
                disabled={!SUPABASE_LINKS.logs}
                title={!SUPABASE_LINKS.logs ? supabaseDisabledMessage : undefined}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Function Logs
              </Button>

              <Button
                variant="outline"
                onClick={() => openSupabaseLink(SUPABASE_LINKS.auth)}
                className="justify-start"
                disabled={!SUPABASE_LINKS.auth}
                title={!SUPABASE_LINKS.auth ? supabaseDisabledMessage : undefined}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Auth Users
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Schema Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Code2 className="h-5 w-5" />
              <span>Data Schema</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                <strong>Read-only schema reference:</strong> All sensitive tables are protected by RLS. 
                The Admin Panel accesses data only via admin endpoints. 
                For row-level inspection outside these endpoints, use Supabase Studio.
              </AlertDescription>
            </Alert>
            
            <div className="mt-4 space-y-3">
              <div className="p-3 bg-muted rounded-lg">
                <code className="text-sm">
                  <strong>profiles</strong>(user_id, whatsapp_e164, ref_code, credits_balance, created_at)
                </code>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <code className="text-sm">
                  <strong>driver_status</strong>(user_id, vehicle_type, location, last_seen, online)
                </code>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <code className="text-sm">
                  <strong>trips</strong>(id, creator_user_id, role, vehicle_type, pickup, status, created_at)
                </code>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <code className="text-sm">
                  <strong>subscriptions</strong>(id, user_id, status, started_at, expires_at, amount, proof_url, txn_id, created_at)
                </code>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <code className="text-sm">
                  <strong>app_config</strong>(id=true, subscription_price, search_radius_km, max_results, momo_payee_number, support_phone_e164, admin_whatsapp_numbers, pro_enabled)
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        <RetrievalPlayground />

      </div>
    </AdminLayout>
  );
}
