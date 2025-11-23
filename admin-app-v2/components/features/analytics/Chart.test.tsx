import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { Chart } from './Chart';

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

const mockData = [
  { name: 'Jan', value: 100 },
  { name: 'Feb', value: 200 },
];

describe('Chart', () => {
  it('renders title', () => {
    renderWithProviders(
      <Chart
        title="Test Chart"
        data={mockData}
        type="line"
        dataKey="value"
        category="name"
      />
    );
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
  });

  it('renders LineChart when type is line', () => {
    renderWithProviders(
      <Chart
        title="Line Chart"
        data={mockData}
        type="line"
        dataKey="value"
        category="name"
      />
    );
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders BarChart when type is bar', () => {
    renderWithProviders(
      <Chart
        title="Bar Chart"
        data={mockData}
        type="bar"
        dataKey="value"
        category="name"
      />
    );
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });
});
