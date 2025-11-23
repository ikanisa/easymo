import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { ConversationViewer } from './ConversationViewer';
import userEvent from '@testing-library/user-event';

describe('ConversationViewer', () => {
  it('renders conversation list', () => {
    renderWithProviders(<ConversationViewer />);
    
    // Use getAllByText because names might appear in list and detail view
    expect(screen.getAllByText('Alice Johnson')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Bob Smith')[0]).toBeInTheDocument();
  });

  it('filters conversations', async () => {
    renderWithProviders(<ConversationViewer />);
    
    const searchInput = screen.getByPlaceholderText(/search conversations/i);
    await userEvent.type(searchInput, 'Alice');
    
    expect(screen.getAllByText('Alice Johnson')[0]).toBeInTheDocument();
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();
  });

  it('selects conversation and shows messages', async () => {
    renderWithProviders(<ConversationViewer />);
    
    // Click on Bob Smith's conversation in the list
    // Bob Smith is in the list, so we can find it.
    // Since mock data has Bob Smith as 2nd item, and selected is Alice (1st),
    // Bob Smith should only be in the list initially (1 occurrence).
    const bobConversation = screen.getByText('Bob Smith');
    await userEvent.click(bobConversation);
    
    // Check if Bob's messages are shown
    expect(screen.getByText('How do I reset my password?')).toBeInTheDocument();
    expect(screen.getByText("I can help you with that. Please click on the 'Forgot Password' link on the login page.")).toBeInTheDocument();
  });

  it('allows typing in message input', async () => {
    renderWithProviders(<ConversationViewer />);
    
    const messageInput = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(messageInput, 'Hello there');
    
    expect(messageInput).toHaveValue('Hello there');
  });
});
