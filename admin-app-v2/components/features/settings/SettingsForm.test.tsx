import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { SettingsForm } from './SettingsForm';
import userEvent from '@testing-library/user-event';

describe('SettingsForm', () => {
  it('renders form title', () => {
    renderWithProviders(<SettingsForm />);
    expect(screen.getByText('General Settings')).toBeInTheDocument();
  });

  it('renders all form fields', () => {
    renderWithProviders(<SettingsForm />);
    expect(screen.getByLabelText(/site name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/support email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max upload size/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/maintenance mode/i)).toBeInTheDocument();
  });

  it('allows updating site name', async () => {
    renderWithProviders(<SettingsForm />);
    const siteNameInput = screen.getByLabelText(/site name/i) as HTMLInputElement;
    await userEvent.clear(siteNameInput);
    await userEvent.type(siteNameInput, 'New Site Name');
    expect(siteNameInput.value).toBe('New Site Name');
  });

  it('allows updating support email', async () => {
    renderWithProviders(<SettingsForm />);
    const emailInput = screen.getByLabelText(/support email/i) as HTMLInputElement;
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'new@example.com');
    expect(emailInput.value).toBe('new@example.com');
  });

  it('allows toggling maintenance mode', async () => {
    renderWithProviders(<SettingsForm />);
    const checkbox = screen.getByLabelText(/maintenance mode/i) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    await userEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('renders save button', () => {
    renderWithProviders(<SettingsForm />);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });
});
