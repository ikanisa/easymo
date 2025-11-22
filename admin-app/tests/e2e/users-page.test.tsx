import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach,describe, expect, it, vi } from 'vitest';

import { UsersClient } from '@/app/(panel)/users/UsersClient';

vi.mock('@/lib/queries/users', () => ({
  useUsersQuery: () => ({
    isLoading: false,
    isFetching: false,
    data: { data: [], total: 0, hasMore: false },
  }),
}));

// Avoid coupling to auth provider in this isolated client test.
vi.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/providers/SupabaseAuthProvider', () => ({
  useSupabaseAuth: () => ({
    user: { id: 'test-user-id' },
    session: { user: { id: 'test-user-id' } },
    status: 'authenticated',
    isAdmin: true,
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    refreshSession: vi.fn(),
  }),
}));

vi.mock('@/components/ui/ToastProvider', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ pushToast: vi.fn() }),
}));

describe('UsersClient', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders users page and empty state', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <UsersClient initialParams={{ limit: 200 }} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('No users yet')).toBeInTheDocument();
  });
});
