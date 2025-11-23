import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../tests/utils';
import { SearchBar } from './SearchBar';
import userEvent from '@testing-library/user-event';

describe('SearchBar', () => {
  it('renders with placeholder', () => {
    renderWithProviders(<SearchBar placeholder="Search..." value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('displays current value', () => {
    renderWithProviders(<SearchBar value="test query" onChange={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('test query');
  });

  it('calls onChange when typing', async () => {
    let value = '';
    const handleChange = (newValue: string) => {
      value = newValue;
    };

    renderWithProviders(<SearchBar value={value} onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'search');
    
    expect(value).toBe('search');
  });

  it('shows clear button when value is not empty', () => {
    renderWithProviders(<SearchBar value="test" onChange={() => {}} />);
    const clearButton = screen.getByRole('button');
    expect(clearButton).toBeInTheDocument();
  });

  it('does not show clear button when value is empty', () => {
    renderWithProviders(<SearchBar value="" onChange={() => {}} />);
    const clearButton = screen.queryByRole('button');
    expect(clearButton).not.toBeInTheDocument();
  });

  it('clears value when clear button is clicked', async () => {
    let value = 'test';
    const handleChange = (newValue: string) => {
      value = newValue;
    };

    renderWithProviders(<SearchBar value={value} onChange={handleChange} />);
    
    const clearButton = screen.getByRole('button');
    await userEvent.click(clearButton);
    
    expect(value).toBe('');
  });

  it('has search icon', () => {
    const { container } = renderWithProviders(<SearchBar value="" onChange={() => {}} />);
    const searchIcon = container.querySelector('svg');
    expect(searchIcon).toBeInTheDocument();
  });
});
