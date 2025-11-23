import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export function useInsuranceLeads() {
  return useQuery({
    queryKey: ['insurance', 'leads'],
    queryFn: () => apiClient.insurance.leads(),
  });
}

export function useInsurancePolicies() {
  return useQuery({
    queryKey: ['insurance', 'policies'],
    queryFn: () => apiClient.insurance.policies(),
  });
}

export function useWalletTransactions() {
  return useQuery({
    queryKey: ['wallet', 'transactions'],
    queryFn: () => apiClient.wallet.transactions(),
  });
}

export function useWalletPartners() {
  return useQuery({
    queryKey: ['wallet', 'partners'],
    queryFn: () => apiClient.wallet.partners(),
  });
}

export function useWhatsAppHealth() {
  return useQuery({
    queryKey: ['whatsapp', 'health'],
    queryFn: () => apiClient.whatsapp.health(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => apiClient.agents.list(),
  });
}

export function useAnalyticsMetrics(params?: any) {
  return useQuery({
    queryKey: ['analytics', 'metrics', params],
    queryFn: () => apiClient.analytics.metrics(params),
  });
}
