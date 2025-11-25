import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../tests/utils';
import { ContactManager } from './ContactManager';

// Mock the useData hook
vi.mock('@/lib/hooks/useData', () => ({
  useInsuranceContacts: vi.fn(() => ({
    data: {
      contacts: [
        {
          id: '1',
          name: 'Sarah Wilson',
          role: 'Insurance Support',
          phone: '+250 788 123 456',
          status: 'online',
        },
        {
          id: '2',
          name: 'Mike Brown',
          role: 'Insurance Support',
          phone: '+250 788 654 321',
          status: 'offline',
        },
      ],
    },
    isLoading: false,
    error: null,
  })),
}));

describe('ContactManager', () => {
  it('renders title and add button', () => {
    renderWithProviders(<ContactManager />);
    expect(screen.getByText('Admin Contacts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add contact/i })).toBeInTheDocument();
  });

  it('renders contacts list', async () => {
    renderWithProviders(<ContactManager />);
    await waitFor(() => {
      expect(screen.getByText('Sarah Wilson')).toBeInTheDocument();
    });
    expect(screen.getByText('Mike Brown')).toBeInTheDocument();
  });

  it('renders status indicators', async () => {
    const { container } = renderWithProviders(<ContactManager />);
    await waitFor(() => {
      // Check for status dots (bg-green-500 for online, bg-gray-400 for offline)
      expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
      expect(container.querySelector('.bg-gray-400')).toBeInTheDocument();
    });
  });

  it('renders action buttons for each contact', async () => {
    renderWithProviders(<ContactManager />);
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      // 1 add button + contacts action buttons
      expect(buttons.length).toBeGreaterThan(1);
    });
  });
});
