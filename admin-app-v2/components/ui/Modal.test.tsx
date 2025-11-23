import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../tests/utils';
import { Modal } from './Modal';
import userEvent from '@testing-library/user-event';

describe('Modal', () => {
  it('renders when isOpen is true', () => {
    renderWithProviders(
      <Modal isOpen onClose={() => {}}>
        <div>Modal content</div>
      </Modal>
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    renderWithProviders(
      <Modal isOpen={false} onClose={() => {}}>
        <div>Modal content</div>
      </Modal>
    );
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <Modal isOpen onClose={handleClose}>
        <div>Modal content</div>
      </Modal>
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    await userEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalled();
  });

  it('renders with title', () => {
    renderWithProviders(
      <Modal isOpen onClose={() => {}} title="Test Modal">
        <div>Content</div>
      </Modal>
    );
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
  });

  it('renders with description', () => {
    renderWithProviders(
      <Modal isOpen onClose={() => {}} description="Test description">
        <div>Content</div>
      </Modal>
    );
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('has overlay with backdrop', () => {
    const { container } = renderWithProviders(
      <Modal isOpen onClose={() => {}}>
        <div>Content</div>
      </Modal>
    );
    const overlay = container.querySelector('.fixed.inset-0');
    expect(overlay).toBeInTheDocument();
  });
});

