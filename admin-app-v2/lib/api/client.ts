// API Client for admin panel
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Type definitions for API requests
interface CreatePolicyRequest {
  userId?: string;
  policyNumber: string;
  insurer?: string;
  status?: string;
  validFrom?: string;
  validUntil?: string;
}

interface CreateContactRequest {
  name: string;
  phone: string;
  type?: string;
  email?: string;
}

class APIClient {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'An error occurred',
      }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // Auth
  auth = {
    login: (email: string, password: string) =>
      this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () =>
      this.request('/api/auth/logout', {
        method: 'POST',
      }),
    session: () => this.request('/api/auth/session'),
  };

  // Users
  users = {
    list: () => this.request('/api/users'),
    get: (id: string) => this.request(`/api/users/${id}`),
    create: (data: Record<string, unknown>) =>
      this.request('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      this.request(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      this.request(`/api/users/${id}`, {
        method: 'DELETE',
      }),
  };

  // Insurance
  insurance = {
    leads: () => this.request('/api/insurance/leads'),
    policies: () => this.request('/api/insurance/policies'),
    createPolicy: (data: CreatePolicyRequest) =>
      this.request('/api/insurance/policies', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    contacts: () => this.request('/api/insurance/contacts'),
    createContact: (data: CreateContactRequest) =>
      this.request('/api/insurance/contacts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Wallet
  wallet = {
    transactions: () => this.request('/api/wallet/transactions'),
    partners: () => this.request('/api/wallet/partners'),
    allocate: (data: Record<string, unknown>) =>
      this.request('/api/wallet/allocate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // WhatsApp
  whatsapp = {
    health: () => this.request('/api/whatsapp/health'),
    templates: () => this.request('/api/whatsapp/templates'),
    createTemplate: (data: Record<string, unknown>) =>
      this.request('/api/whatsapp/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Agents
  agents = {
    list: () => this.request('/api/agents'),
    get: (id: string) => this.request(`/api/agents/${id}`),
    updateConfig: (id: string, data: Record<string, unknown>) =>
      this.request(`/api/agents/${id}/config`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  };

  // Analytics
  analytics = {
    metrics: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      return this.request(`/api/analytics/metrics${query}`);
    },
  };
}

export const apiClient = new APIClient();
