import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VouchersClient } from '@/app/(panel)/vouchers/VouchersClient';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/ToastProvider';

vi.mock('@/lib/queries/vouchers', () => ({
  useVouchersQuery: () => ({
    isLoading: false,
    isFetching: false,
    data: { data: [], total: 0, hasMore: false },
  }),
}));

vi.mock('@/lib/queries/adminVouchers', () => ({
  useAdminVoucherRecentQuery: () => ({ isLoading: false, data: { vouchers: [], messages: [] } }),
}));

vi.mock('@/lib/queries/integrations', () => ({
  useIntegrationStatusQuery: () => ({ isLoading: false, data: {} }),
}));

describe('VouchersClient', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders vouchers page and empty state', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <VouchersClient initialParams={{ limit: 200 }} />
        </ToastProvider>
      </QueryClientProvider>
    );
    expect(screen.getByText('Vouchers')).toBeInTheDocument();
    expect(screen.getByText('No vouchers')).toBeInTheDocument();
  });
});

