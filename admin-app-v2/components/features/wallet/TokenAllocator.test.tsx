import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { TokenAllocator } from './TokenAllocator';
import userEvent from '@testing-library/user-event';

describe('TokenAllocator', () => {
  it('renders allocation form', () => {
    renderWithProviders(<TokenAllocator onAllocate={() => {}} />);
    
    expect(screen.getByText(/allocate tokens/i)).toBeInTheDocument();
  });

  it('renders recipient type selector', () => {
    renderWithProviders(<TokenAllocator onAllocate={() => {}} />);
    
    expect(screen.getByLabelText(/recipient type/i)).toBeInTheDocument();
  });

  it('renders amount input', () => {
    renderWithProviders(<TokenAllocator onAllocate={() => {}} />);
    
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });

  it('handles form submission', async () => {
    const handleAllocate = vi.fn();
    renderWithProviders(<TokenAllocator onAllocate={handleAllocate} />);
    
    const amountInput = screen.getByLabelText(/amount/i);
    await userEvent.type(amountInput, '1000');
    
    const submitButton = screen.getByRole('button', { name: /allocate/i });
    await userEvent.click(submitButton);
    
    expect(handleAllocate).toHaveBeenCalled();
  });

  it('shows validation error for empty amount', async () => {
    renderWithProviders(<TokenAllocator onAllocate={() => {}} />);
    
    const submitButton = screen.getByRole('button', { name: /allocate/i });
    await userEvent.click(submitButton);
    
    expect(screen.getByText(/amount is required/i)).toBeInTheDocument();
  });

  it('renders partner selection when partner type is selected', async () => {
    renderWithProviders(<TokenAllocator onAllocate={() => {}} />);
    
    const typeSelect = screen.getByLabelText(/recipient type/i);
    await userEvent.selectOptions(typeSelect, 'partner');
    
    expect(screen.getByLabelText(/select partner/i)).toBeInTheDocument();
  });
});
