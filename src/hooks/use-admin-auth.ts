/**
 * Admin Authentication Hook
 * Handles unauthorized states and token management
 */

import { useState, useEffect } from 'react';
import { AdminAPI, isUnauthorized } from '@/lib/api';

export function useAdminAuth() {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [adminToken, setAdminToken] = useState<string>(
    import.meta.env.VITE_ADMIN_TOKEN || localStorage.getItem('admin_token') || ''
  );

  // Check authorization on mount
  useEffect(() => {
    checkAuth();
  }, [adminToken]);

  const checkAuth = async () => {
    if (!adminToken) {
      setIsAuthorized(false);
      return;
    }

    try {
      // Update environment variable temporarily for this check
      if (adminToken !== import.meta.env.VITE_ADMIN_TOKEN) {
        // Store in localStorage for persistence
        localStorage.setItem('admin_token', adminToken);
      }
      
      await AdminAPI.healthCheck();
      setIsAuthorized(true);
    } catch (error) {
      if (isUnauthorized(error)) {
        setIsAuthorized(false);
      } else {
        // Network or other error - assume authorized if token exists
        setIsAuthorized(!!adminToken);
      }
    }
  };

  const updateToken = (newToken: string) => {
    setAdminToken(newToken);
    localStorage.setItem('admin_token', newToken);
    // Force reload to pick up new token
    setTimeout(() => window.location.reload(), 100);
  };

  return {
    isAuthorized,
    adminToken,
    updateToken,
    checkAuth
  };
}