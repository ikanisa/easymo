import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../tests/utils';
import { Radio } from './Radio';
import userEvent from '@testing-library/user-event';

describe('Radio', () => {
  it('renders with label', () => {
    renderWithProviders(<Radio label="Option A" name="option" value="a" />);
    expect(screen.getByText('Option A')).toBeInTheDocument();
  });

  it('renders without label', () => {
    renderWithProviders(<Radio name="option" value="a" />);
    const radio = screen.getByRole('radio');
    expect(radio).toBeInTheDocument();
  });

  it('handles selection', async () => {
    let selectedValue = '';
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      selectedValue = e.target.value;
    };

    renderWithProviders(
      <Radio name="option" value="test" onChange={handleChange} />
    );
    
    const radio = screen.getByRole('radio');
    await userEvent.click(radio);
    
    expect(selectedValue).toBe('test');
  });

  it('is checked when checked prop is true', () => {
    renderWithProviders(<Radio name="option" value="a" checked />);
    const radio = screen.getByRole('radio') as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });

  it('is unchecked by default', () => {
    renderWithProviders(<Radio name="option" value="a" />);
    const radio = screen.getByRole('radio') as HTMLInputElement;
    expect(radio.checked).toBe(false);
  });

  it('is disabled when disabled prop is true', () => {
    renderWithProviders(<Radio name="option" value="a" disabled />);
    expect(screen.getByRole('radio')).toBeDisabled();
  });

  it('shows error message', () => {
    renderWithProviders(
      <Radio label="Option" name="option" value="a" error="Required" />
    );
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('groups radios with same name', () => {
    renderWithProviders(
      <>
        <Radio label="Option A" name="group" value="a" />
        <Radio label="Option B" name="group" value="b" />
      </>
    );
    
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    radios.forEach(radio => {
      expect(radio).toHaveAttribute('name', 'group');
    });
  });
});
