import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { PolicyCard } from './PolicyCard';

const mockPolicy = {
  policyNumber: 'POL123456',
  holderName: 'John Doe',
  type: 'Auto',
  status: 'Active',
  premium: '$120.00',
  expiryDate: '2026-12-31',
};

describe('PolicyCard', () => {
  it('renders all policy details', () => {
    renderWithProviders(<PolicyCard {...mockPolicy} />);
    expect(screen.getByText(mockPolicy.policyNumber)).toBeInTheDocument();
    expect(screen.getByText(mockPolicy.holderName)).toBeInTheDocument();
    expect(screen.getByText(mockPolicy.type)).toBeInTheDocument();
    expect(screen.getByText(mockPolicy.status)).toBeInTheDocument();
    expect(screen.getByText(mockPolicy.premium)).toBeInTheDocument();
    expect(screen.getByText(mockPolicy.expiryDate)).toBeInTheDocument();
  });

  it('applies correct status styling', () => {
    renderWithProviders(<PolicyCard {...mockPolicy} status="Inactive" />);
    const statusElement = screen.getByText('Inactive');
    // Assuming status badge has a class based on status, e.g., "bg-red-100" for Inactive
    expect(statusElement).toHaveClass('bg-red-100');
  });
});
