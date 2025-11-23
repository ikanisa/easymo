import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../tests/utils';
import { Container } from './Container';

describe('Container', () => {
  it('renders children', () => {
    renderWithProviders(
      <Container>
        <div>Container content</div>
      </Container>
    );
    expect(screen.getByText('Container content')).toBeInTheDocument();
  });

  it('applies default size (xl)', () => {
    const { container } = renderWithProviders(
      <Container>Content</Container>
    );
    expect(container.firstChild).toHaveClass('max-w-[1920px]');
  });

  it('applies sm size', () => {
    const { container } = renderWithProviders(
      <Container size="sm">Content</Container>
    );
    expect(container.firstChild).toHaveClass('max-w-3xl');
  });

  it('applies md size', () => {
    const { container } = renderWithProviders(
      <Container size="md">Content</Container>
    );
    expect(container.firstChild).toHaveClass('max-w-5xl');
  });

  it('applies lg size', () => {
    const { container } = renderWithProviders(
      <Container size="lg">Content</Container>
    );
    expect(container.firstChild).toHaveClass('max-w-7xl');
  });

  it('applies full size', () => {
    const { container } = renderWithProviders(
      <Container size="full">Content</Container>
    );
    expect(container.firstChild).toHaveClass('max-w-full');
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(
      <Container className="custom-class">Content</Container>
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('has responsive padding', () => {
    const { container } = renderWithProviders(
      <Container>Content</Container>
    );
    expect(container.firstChild).toHaveClass('px-4', 'sm:px-6', 'lg:px-8');
  });
});
