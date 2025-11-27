/**
 * Standardized API Client with Toast Integration
 * Provides consistent error handling and toast notifications
 */

'use client';

import { useCallback } from 'react';

import { useToast } from '@/components/ui/toast';

interface ApiOptions extends RequestInit {
  showSuccessToast?: boolean;
  successMessage?: string;
  showErrorToast?: boolean;
  errorMessage?: string;
}

export function useApiClient() {
  const toast = useToast();

  const apiCall = useCallback(async <T = any>(
    url: string,
    options: ApiOptions = {}
  ): Promise<T> => {
    const {
      showSuccessToast = false,
      successMessage = 'Success',
      showErrorToast = true,
      errorMessage,
      ...fetchOptions
    } = options;

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (showSuccessToast) {
        toast.success(successMessage);
      }

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      
      if (showErrorToast) {
        toast.error(errorMessage || 'Request Failed', message);
      }

      throw error;
    }
  }, [toast]);

  const get = useCallback(<T = any>(url: string, options?: Omit<ApiOptions, 'method' | 'body'>) => {
    return apiCall<T>(url, { ...options, method: 'GET' });
  }, [apiCall]);

  const post = useCallback(<T = any>(url: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) => {
    return apiCall<T>(url, { ...options, method: 'POST', body: JSON.stringify(body) });
  }, [apiCall]);

  const put = useCallback(<T = any>(url: string, body?: any, options?: Omit<ApiOptions, 'method' | 'body'>) => {
    return apiCall<T>(url, { ...options, method: 'PUT', body: JSON.stringify(body) });
  }, [apiCall]);

  const del = useCallback(<T = any>(url: string, options?: Omit<ApiOptions, 'method' | 'body'>) => {
    return apiCall<T>(url, { ...options, method: 'DELETE' });
  }, [apiCall]);

  return {
    get,
    post,
    put,
    delete: del,
    apiCall,
  };
}
