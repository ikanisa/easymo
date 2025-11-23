import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { AgentCard } from './AgentCard';
import userEvent from '@testing-library/user-event';

const mockAgent = {
  id: 'agent-1',
  name: 'Sales Bot',
  description: 'Handles sales inquiries',
  status: 'active' as const,
  type: 'sales' as const,
  conversations: 150,
};

describe('AgentCard', () => {
  it('renders agent details', () => {
    renderWithProviders(
      <AgentCard
        agent={mockAgent}
        onToggle={() => {}}
        onConfigure={() => {}}
      />
    );

    expect(screen.getByText(mockAgent.name)).toBeInTheDocument();
    expect(screen.getByText(mockAgent.description)).toBeInTheDocument();
    expect(screen.getByText(mockAgent.type)).toBeInTheDocument();
    expect(screen.getByText(mockAgent.conversations.toString())).toBeInTheDocument();
  });

  it('renders correct status badge', () => {
    renderWithProviders(
      <AgentCard
        agent={mockAgent}
        onToggle={() => {}}
        onConfigure={() => {}}
      />
    );

    const statusBadge = screen.getByText(mockAgent.status);
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveClass('bg-green-500'); // Success variant
  });

  it('renders pause icon when active', () => {
    renderWithProviders(
      <AgentCard
        agent={mockAgent}
        onToggle={() => {}}
        onConfigure={() => {}}
      />
    );

    // Pause icon is rendered when status is active
    // We can check for the button that contains the pause icon
    // The button has specific classes based on status
    const toggleButton = screen.getAllByRole('button')[0];
    expect(toggleButton).toHaveClass('text-yellow-600');
  });

  it('renders play icon when paused', () => {
    const pausedAgent = { ...mockAgent, status: 'paused' as const };
    renderWithProviders(
      <AgentCard
        agent={pausedAgent}
        onToggle={() => {}}
        onConfigure={() => {}}
      />
    );

    const toggleButton = screen.getAllByRole('button')[0];
    expect(toggleButton).toHaveClass('text-green-600');
  });

  it('calls onToggle when toggle button is clicked', async () => {
    const handleToggle = vi.fn();
    renderWithProviders(
      <AgentCard
        agent={mockAgent}
        onToggle={handleToggle}
        onConfigure={() => {}}
      />
    );

    const toggleButton = screen.getAllByRole('button')[0];
    await userEvent.click(toggleButton);
    expect(handleToggle).toHaveBeenCalledWith(mockAgent.id);
  });

  it('calls onConfigure when settings button is clicked', async () => {
    const handleConfigure = vi.fn();
    renderWithProviders(
      <AgentCard
        agent={mockAgent}
        onToggle={() => {}}
        onConfigure={handleConfigure}
      />
    );

    const settingsButton = screen.getAllByRole('button')[1];
    await userEvent.click(settingsButton);
    expect(handleConfigure).toHaveBeenCalledWith(mockAgent.id);
  });
});
