import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { LeadsQueue } from './LeadsQueue';

describe('LeadsQueue', () => {
  it('renders title and pending count', () => {
    renderWithProviders(<LeadsQueue />);
    expect(screen.getByText('Leads Queue')).toBeInTheDocument();
    expect(screen.getByText(/Pending/)).toBeInTheDocument();
  });

  it('renders leads list', () => {
    renderWithProviders(<LeadsQueue />);
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Toyota RAV4 2020, Comprehensive')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
  });

  it('renders action buttons for each lead', () => {
    renderWithProviders(<LeadsQueue />);
    // 3 leads * 2 buttons = 6 buttons
    // Buttons don't have accessible names, so we check for button role
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(6);
  });
});
