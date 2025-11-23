
import { describe, it, expect, vi } from 'vitest';
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
    const handleChange = vi.fn();

    renderWithProviders(<SearchBar value="" onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'search');
    
    expect(handleChange).toHaveBeenCalledTimes(6); // For each character typed
    expect(handleChange).toHaveBeenLastCalledWith('search');
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
    const handleChange = vi.fn();

    renderWithProviders(<SearchBar value="test" onChange={handleChange} />);
    
    const clearButton = screen.getByRole('button');
    await userEvent.click(clearButton);
    
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('has search icon', () => {
    const { container } = renderWithProviders(<SearchBar value="" onChange={() => {}} />);
    const searchIcon = container.querySelector('svg');
    expect(searchIcon).toBeInTheDocument();
  });
});

