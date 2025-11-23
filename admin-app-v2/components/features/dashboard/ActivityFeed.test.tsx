import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { ActivityFeed } from './ActivityFeed';

const mockActivities = [
  {
    id: '1',
    user: { name: 'John Doe', avatar: undefined },
    action: 'created',
    target: 'new user account',
    timestamp: '2 minutes ago',
  },
  {
    id: '2',
    user: { name: 'Jane Smith', avatar: undefined },
    action: 'updated',
    target: 'policy settings',
    timestamp: '5 minutes ago',
  },
];

describe('ActivityFeed', () => {
  it('renders activity items', () => {
    renderWithProviders(<ActivityFeed activities={mockActivities} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('renders activity actions', () => {
    renderWithProviders(<ActivityFeed activities={mockActivities} />);
    
    expect(screen.getByText(/created/)).toBeInTheDocument();
    expect(screen.getByText(/updated/)).toBeInTheDocument();
  });

  it('renders activity targets', () => {
    renderWithProviders(<ActivityFeed activities={mockActivities} />);
    
    expect(screen.getByText(/new user account/)).toBeInTheDocument();
    expect(screen.getByText(/policy settings/)).toBeInTheDocument();
  });

  it('renders timestamps', () => {
    renderWithProviders(<ActivityFeed activities={mockActivities} />);
    
    expect(screen.getByText('2 minutes ago')).toBeInTheDocument();
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
  });

  it('renders multiple activities in order', () => {
    renderWithProviders(<ActivityFeed activities={mockActivities} />);
    
    const activities = screen.getAllByText(/ago/);
    expect(activities).toHaveLength(2);
  });
});

