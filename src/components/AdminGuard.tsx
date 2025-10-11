/**
 * Admin Guard Component
 * Protects admin routes and handles authentication
 */

import { useAdminAuth } from '@/hooks/use-admin-auth';
import { NotAuthorized } from './NotAuthorized';
import { Card, CardContent } from './ui/card';
import { Loader2 } from 'lucide-react';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { isAuthorized, adminToken, updateToken } = useAdminAuth();

  // Loading state
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card>
          <CardContent className="p-6 flex items-center space-x-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Checking authorization...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authorized
  if (!isAuthorized) {
    return <NotAuthorized onTokenUpdate={updateToken} currentToken={adminToken} />;
  }

  // Authorized - render admin panel
  return <>{children}</>;
}