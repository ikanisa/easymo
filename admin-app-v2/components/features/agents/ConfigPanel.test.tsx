import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { ConfigPanel } from './ConfigPanel';
import userEvent from '@testing-library/user-event';

describe('ConfigPanel', () => {
  it('renders configuration form', () => {
    renderWithProviders(<ConfigPanel />);
    
    expect(screen.getByLabelText(/agent name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/model/i)).toBeInTheDocument();
    expect(screen.getByText(/temperature/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/system prompt/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
  });

  it('allows updating agent name', async () => {
    renderWithProviders(<ConfigPanel />);
    
    const nameInput = screen.getByLabelText(/agent name/i) as HTMLInputElement;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'New Agent Name');
    
    expect(nameInput.value).toBe('New Agent Name');
  });

  it('allows updating model', async () => {
    renderWithProviders(<ConfigPanel />);
    
    const modelSelect = screen.getByLabelText(/model/i);
    await userEvent.selectOptions(modelSelect, 'gpt-3.5-turbo');
    
    expect((modelSelect as HTMLSelectElement).value).toBe('gpt-3.5-turbo');
  });

  it('allows updating system prompt', async () => {
    renderWithProviders(<ConfigPanel />);
    
    const promptInput = screen.getByLabelText(/system prompt/i) as HTMLTextAreaElement;
    await userEvent.clear(promptInput);
    await userEvent.type(promptInput, 'New system prompt');
    
    expect(promptInput.value).toBe('New system prompt');
  });
});
