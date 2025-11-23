import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { MetricCard } from './MetricCard';
import { TrendingUp } from 'lucide-react';

describe('MetricCard', () => {
  it('renders title and value', () => {
    renderWithProviders(
      <MetricCard title="Total Users" value="1,234" icon={TrendingUp} />
    );
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('renders with change indicator', () => {
    renderWithProviders(
      <MetricCard
        title="Revenue"
        value="$45,231"
        change="+20.1%"
        trend="up"
        icon={TrendingUp}
      />
    );
    expect(screen.getByText('+20.1%')).toBeInTheDocument();
  });

  it('renders without change indicator', () => {
    renderWithProviders(
      <MetricCard title="Active" value="100" icon={TrendingUp} />
    );
    expect(screen.queryByText('%')).not.toBeInTheDocument();
  });

  it('applies up trend styles', () => {
    renderWithProviders(
      <MetricCard
        title="Growth"
        value="15%"
        change="+5%"
        trend="up"
        icon={TrendingUp}
      />
    );
    const changeElement = screen.getByText('+5%');
    expect(changeElement).toHaveClass('text-green-600');
  });

  it('applies down trend styles', () => {
    renderWithProviders(
      <MetricCard
        title="Bounce Rate"
        value="42%"
        change="-5%"
        trend="down"
        icon={TrendingUp}
      />
    );
    const changeElement = screen.getByText('-5%');
    expect(changeElement).toHaveClass('text-red-600');
  });

  it('renders icon', () => {
    const { container } = renderWithProviders(
      <MetricCard title="Test" value="100" icon={TrendingUp} />
    );
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });
});
