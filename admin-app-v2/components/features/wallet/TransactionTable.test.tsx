import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { TransactionTable } from './TransactionTable';

const mockTransactions = [
  {
    id: 'TX123',
    type: 'allocation',
    amount: '+500',
    recipient: 'Partner A',
    status: 'completed',
    timestamp: '2024-01-15 10:30',
  },
  {
    id: 'TX124',
    type: 'transfer',
    amount: '-200',
    recipient: 'User B',
    status: 'pending',
    timestamp: '2024-01-15 11:00',
  },
];

describe('TransactionTable', () => {
  it('renders transaction data', () => {
    renderWithProviders(<TransactionTable transactions={mockTransactions} />);
    
    expect(screen.getByText('TX123')).toBeInTheDocument();
    expect(screen.getByText('TX124')).toBeInTheDocument();
  });

  it('renders transaction types', () => {
    renderWithProviders(<TransactionTable transactions={mockTransactions} />);
    
    expect(screen.getByText('allocation')).toBeInTheDocument();
    expect(screen.getByText('transfer')).toBeInTheDocument();
  });

  it('renders transaction amounts', () => {
    renderWithProviders(<TransactionTable transactions={mockTransactions} />);
    
    expect(screen.getByText('+500')).toBeInTheDocument();
    expect(screen.getByText('-200')).toBeInTheDocument();
  });

  it('renders recipients', () => {
    renderWithProviders(<TransactionTable transactions={mockTransactions} />);
    
    expect(screen.getByText('Partner A')).toBeInTheDocument();
    expect(screen.getByText('User B')).toBeInTheDocument();
  });

  it('renders transaction status', () => {
    renderWithProviders(<TransactionTable transactions={mockTransactions} />);
    
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders timestamps', () => {
    renderWithProviders(<TransactionTable transactions={mockTransactions} />);
    
    expect(screen.getByText(/2024-01-15 10:30/)).toBeInTheDocument();
    expect(screen.getByText(/2024-01-15 11:00/)).toBeInTheDocument();
  });

  it('applies positive amount styling', () => {
    renderWithProviders(<TransactionTable transactions={mockTransactions} />);
    
    const positiveAmount = screen.getByText('+500');
    expect(positiveAmount).toHaveClass('text-green-600');
  });

  it('applies negative amount styling', () => {
    renderWithProviders(<TransactionTable transactions={mockTransactions} />);
    
    const negativeAmount = screen.getByText('-200');
    expect(negativeAmount).toHaveClass('text-red-600');
  });
});
