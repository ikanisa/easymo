import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../tests/utils';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders with image src', () => {
    renderWithProviders(<Avatar src="https://example.com/avatar.jpg" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('renders fallback when no src provided', () => {
    renderWithProviders(<Avatar fallback="JD" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('generates initials from fallback text', () => {
    renderWithProviders(<Avatar fallback="John Doe" />);
    expect(screen.getByText('Jo')).toBeInTheDocument();
  });

  it('uses first two characters if single word', () => {
    renderWithProviders(<Avatar fallback="Admin" />);
    expect(screen.getByText('Ad')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(
      <Avatar fallback="JD" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders with alt text', () => {
    renderWithProviders(<Avatar src="avatar.jpg" alt="User avatar" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'User avatar');
  });

  it('has circular shape', () => {
    const { container } = renderWithProviders(<Avatar fallback="JD" />);
    expect(container.firstChild).toHaveClass('rounded-full');
  });
});
