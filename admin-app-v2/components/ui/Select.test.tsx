import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../tests/utils';
import { Select } from './Select';
import userEvent from '@testing-library/user-event';

describe('Select', () => {
  const options = [
    { label: 'Option 1', value: '1' },
    { label: 'Option 2', value: '2' },
    { label: 'Option 3', value: '3' },
  ];

  it('renders with label', () => {
    renderWithProviders(<Select label="Choose option" options={options} />);
    expect(screen.getByText('Choose option')).toBeInTheDocument();
  });

  it('renders all options', () => {
    renderWithProviders(<Select options={options} />);
    const select = screen.getByRole('combobox');
    
    options.forEach(option => {
      const optionElement = screen.getByRole('option', { name: option.label });
      expect(optionElement).toBeInTheDocument();
    });
  });

  it('handles value changes', async () => {
    let selectedValue = '';
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      selectedValue = e.target.value;
    };

    renderWithProviders(<Select options={options} onChange={handleChange} />);
    
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, '2');
    
    expect(selectedValue).toBe('2');
  });

  it('shows selected value', () => {
    renderWithProviders(<Select options={options} value="2" />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('2');
  });

  it('shows error message', () => {
    renderWithProviders(<Select label="Select" options={options} error="Required field" />);
    expect(screen.getByText('Required field')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    renderWithProviders(<Select options={options} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('applies error styles when error is present', () => {
    renderWithProviders(<Select options={options} error="Error" />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('border-error');
  });
});
