import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { AuditLog } from './AuditLog';

describe('AuditLog', () => {
  it('renders title and description', () => {
    renderWithProviders(<AuditLog />);
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
    expect(screen.getByText('System activity and security events')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    renderWithProviders(<AuditLog />);
    const headers = ['Timestamp', 'User', 'Action', 'Resource', 'Status', 'IP Address'];
    headers.forEach((h) => expect(screen.getByText(h)).toBeInTheDocument());
  });

  it('renders log entries', () => {
    renderWithProviders(<AuditLog />);
    expect(screen.getByText('admin@easymo.com')).toBeInTheDocument();
    expect(screen.getByText('User Created')).toBeInTheDocument();
    expect(screen.getByText('users/123')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
  });

  it('renders correct status styling', () => {
    renderWithProviders(<AuditLog />);
    const successBadges = screen.getAllByText('success');
    expect(successBadges[0]).toHaveClass('bg-green-500');
    
    const failedBadge = screen.getByText('failed');
    expect(failedBadge).toHaveClass('bg-red-500');
  });
});
