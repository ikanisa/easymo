import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { InsightCard } from './InsightCard';

describe('InsightCard', () => {
  it('renders card content', () => {
    renderWithProviders(
      <InsightCard
        title="Total Revenue"
        value="$50,000"
        change="+12%"
        trend="up"
        description="Compared to last month"
      />
    );
    
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('$50,000')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('Compared to last month')).toBeInTheDocument();
  });

  it('renders upward trend correctly', () => {
    renderWithProviders(
      <InsightCard
        title="Revenue"
        value="$100"
        change="+5%"
        trend="up"
        description="test"
      />
    );
    
    const changeElement = screen.getByText('+5%');
    expect(changeElement).toHaveClass('text-green-600');
    expect(changeElement.querySelector('svg')).toBeInTheDocument();
  });

  it('renders downward trend correctly', () => {
    renderWithProviders(
      <InsightCard
        title="Revenue"
        value="$100"
        change="-5%"
        trend="down"
        description="test"
      />
    );
    
    const changeElement = screen.getByText('-5%');
    expect(changeElement).toHaveClass('text-red-600');
  });

  it('renders neutral trend correctly', () => {
    renderWithProviders(
      <InsightCard
        title="Revenue"
        value="$100"
        change="0%"
        trend="neutral"
        description="test"
      />
    );
    
    const changeElement = screen.getByText('0%');
    expect(changeElement).toHaveClass('text-gray-600');
  });
});
