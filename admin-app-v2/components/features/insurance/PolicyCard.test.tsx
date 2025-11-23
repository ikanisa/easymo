import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { PolicyCard } from './PolicyCard';

const mockPolicy = {
  id: '1',
  policyNumber: 'POL123456',
  holderName: 'John Doe',
  type: 'Auto',
  status: 'active' as const,
  premium: '$120.00',
  expiryDate: '2026-12-31',
};

describe('PolicyCard', () => {
  it('renders all policy details', () => {
    renderWithProviders(<PolicyCard policy={mockPolicy} />);
    expect(screen.getByText(`#${mockPolicy.policyNumber}`)).toBeInTheDocument();
    expect(screen.getByText(mockPolicy.holderName)).toBeInTheDocument();
    expect(screen.getByText('Auto Insurance')).toBeInTheDocument();
    expect(screen.getByText(mockPolicy.status)).toBeInTheDocument();
    expect(screen.getByText(mockPolicy.premium)).toBeInTheDocument();
    expect(screen.getByText(mockPolicy.expiryDate)).toBeInTheDocument();
  });

  it('applies correct status styling', () => {
    const inactivePolicy = { ...mockPolicy, status: 'expired' as const };
    renderWithProviders(<PolicyCard policy={inactivePolicy} />);
    const statusElement = screen.getByText('expired');
    expect(statusElement).toHaveClass('bg-red-500');
  });
});
