import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../tests/utils';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders with text', () => {
    renderWithProviders(<Badge>Badge text</Badge>);
    expect(screen.getByText('Badge text')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    renderWithProviders(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toHaveClass('bg-primary-600');
  });

  it('applies success variant styles', () => {
    renderWithProviders(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge).toHaveClass('bg-green-500');
  });

  it('applies warning variant styles', () => {
    renderWithProviders(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge).toHaveClass('bg-yellow-500');
  });

  it('applies destructive variant styles', () => {
    renderWithProviders(<Badge variant="destructive">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge).toHaveClass('bg-red-500');
  });

  it('applies outline variant styles', () => {
    renderWithProviders(<Badge variant="outline">Outline</Badge>);
    const badge = screen.getByText('Outline');
    expect(badge).toHaveClass('border');
  });

  it('applies custom className', () => {
    renderWithProviders(<Badge className="custom-class">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('custom-class');
  });

  it('renders as inline element', () => {
    const { container } = renderWithProviders(<Badge>Inline</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('inline-flex');
  });
});
