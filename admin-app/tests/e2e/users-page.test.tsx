import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UsersClient } from '@/app/(panel)/users/UsersClient';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/queries/users', () => ({
  useUsersQuery: () => ({
    isLoading: false,
    isFetching: false,
    data: { data: [], total: 0, hasMore: false },
  }),
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

