/**
 * Not Authorized Screen
 * Shows when admin token is missing or invalid
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Eye, EyeOff } from 'lucide-react';

interface NotAuthorizedProps {
  onTokenUpdate: (token: string) => void;
  currentToken?: string;
}

export function NotAuthorized({ onTokenUpdate, currentToken }: NotAuthorizedProps) {
  const [token, setToken] = useState(currentToken || '');
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      onTokenUpdate(token.trim());
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Shield className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Not Authorized</CardTitle>
          <p className="text-sm text-muted-foreground">
            Valid admin token required to access the operations console
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Admin Token</Label>
              <div className="relative">
                <Input
                  id="token"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter your admin token..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                The token is set in environment variable <code>VITE_ADMIN_TOKEN</code> or can be provided here for testing.
                It will be stored in localStorage and used for all API calls.
              </AlertDescription>
            </Alert>

            <Button 
              type="submit" 
              className="w-full"
              disabled={!token.trim()}
            >
              Update Token & Reload
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}