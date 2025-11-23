import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../tests/utils';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders spinner element', () => {
    const { container } = renderWithProviders(<Spinner />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(<Spinner className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('has default size', () => {
    const { container } = renderWithProviders(<Spinner />);
    const spinner = container.firstChild;
    expect(spinner).toHaveClass('h-6', 'w-6');
  });

  it('renders with animation', () => {
    const { container } = renderWithProviders(<Spinner />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
