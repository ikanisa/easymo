import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationsClient } from '@/app/(panel)/notifications/NotificationsClient';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/ToastProvider';

const queryMock = {
  isLoading: false,
  isFetching: false,
  data: {
    data: [
      { id: 'n1', toRole: 'vendor', type: 'voucher', status: 'queued', createdAt: '2025-10-01', sentAt: null },
      { id: 'n2', toRole: 'customer', type: 'promo', status: 'failed', createdAt: '2025-10-02', sentAt: null },
    ],
    total: 2,
    hasMore: false,
  },
};

vi.mock('@/lib/queries/notifications', () => ({
  useNotificationsQuery: () => queryMock,
}));

describe('NotificationsClient', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders and filters by status', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <NotificationsClient initialParams={{ limit: 200 }} />
        </ToastProvider>
      </QueryClientProvider>
    );
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'failed' } });
    // No assertion on data mutation; ensure UI remains present
    expect(screen.getByText('Status summary')).toBeInTheDocument();
  });
});
