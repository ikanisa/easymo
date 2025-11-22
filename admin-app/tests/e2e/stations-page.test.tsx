import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach,describe, expect, it, vi } from 'vitest';

import { StationsClient } from '@/app/(panel)/stations/StationsClient';

vi.mock('@/lib/queries/stations', () => ({
  useStationsQuery: () => ({
    isLoading: false,
    isFetching: false,
    data: { data: [], total: 0, hasMore: false },
  }),
}));

describe('StationsClient', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders stations page and empty state', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <StationsClient initialParams={{ limit: 200 }} />
      </QueryClientProvider>
    );
    expect(screen.getByText('Stations')).toBeInTheDocument();
    expect(screen.getByText('No stations')).toBeInTheDocument();
  });
});

