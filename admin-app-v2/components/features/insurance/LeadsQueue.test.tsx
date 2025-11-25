import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../tests/utils';
import { LeadsQueue } from './LeadsQueue';

// Mock the useData hook
vi.mock('@/lib/hooks/useData', () => ({
  useInsuranceLeads: vi.fn(() => ({
    data: {
      leads: [
        {
          id: '1',
          customerName: 'Alice Johnson',
          type: 'motor',
          status: 'new',
          submittedAt: new Date().toISOString(),
          details: 'Toyota RAV4 2020, Comprehensive',
        },
        {
          id: '2',
          customerName: 'Bob Smith',
          type: 'health',
          status: 'reviewing',
          submittedAt: new Date().toISOString(),
          details: 'Family Plan, 4 members',
        },
      ],
    },
    isLoading: false,
    error: null,
  })),
}));

describe('LeadsQueue', () => {
  it('renders title and pending count', () => {
    renderWithProviders(<LeadsQueue />);
    expect(screen.getByText('Leads Queue')).toBeInTheDocument();
    expect(screen.getByText(/Pending/)).toBeInTheDocument();
  });

  it('renders leads list', async () => {
    renderWithProviders(<LeadsQueue />);
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
    expect(screen.getByText('Toyota RAV4 2020, Comprehensive')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
  });

  it('renders action buttons for each lead', async () => {
    renderWithProviders(<LeadsQueue />);
    await waitFor(() => {
      // 2 leads * 2 buttons = 4 action buttons
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(4);
    });
  });
});
