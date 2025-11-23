import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../tests/utils';
import { Checkbox } from './Checkbox';
import userEvent from '@testing-library/user-event';

describe('Checkbox', () => {
  it('renders with label', () => {
    renderWithProviders(<Checkbox label="Accept terms" />);
    expect(screen.getByText('Accept terms')).toBeInTheDocument();
  });

  it('renders without label', () => {
    renderWithProviders(<Checkbox />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
  });

  it('handles check/uncheck', async () => {
    let checked = false;
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      checked = e.target.checked;
    };

    renderWithProviders(<Checkbox onChange={handleChange} />);
    
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    
    expect(checked).toBe(true);
  });

  it('is checked when checked prop is true', () => {
    renderWithProviders(<Checkbox checked />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('is unchecked by default', () => {
    renderWithProviders(<Checkbox />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('is disabled when disabled prop is true', () => {
    renderWithProviders(<Checkbox disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('shows error message', () => {
    renderWithProviders(<Checkbox label="Terms" error="You must accept" />);
    expect(screen.getByText('You must accept')).toBeInTheDocument();
  });

  it('applies error styles when error is present', () => {
    renderWithProviders(<Checkbox error="Error" />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveClass('border-red-500');
  });
});
