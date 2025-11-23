import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../tests/utils';
import { UserTable } from './UserTable';

const mockUsers = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    role: 'admin',
    status: 'active',
    lastActive: '2 days ago',
    avatar: undefined,
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    role: 'user',
    status: 'inactive',
    lastActive: '5 days ago',
    avatar: undefined,
  },
];

describe('UserTable', () => {
  it('renders table headers', () => {
    renderWithProviders(<UserTable users={[]} onEdit={() => {}} onDelete={() => {}} />);
    const headers = ['User', 'Role', 'Status', 'Last Active', 'Actions'];
    headers.forEach((h) => expect(screen.getByText(h)).toBeInTheDocument());
  });

  it('renders user rows with correct data', () => {
    renderWithProviders(<UserTable users={mockUsers} onEdit={() => {}} onDelete={() => {}} />);
    mockUsers.forEach((user) => {
      expect(screen.getByText(user.name)).toBeInTheDocument();
      expect(screen.getByText(user.email)).toBeInTheDocument();
      expect(screen.getByText(user.role)).toBeInTheDocument();
      expect(screen.getByText(user.status)).toBeInTheDocument();
      expect(screen.getByText(user.lastActive)).toBeInTheDocument();
    });
  });

  it('calls onEdit when edit button is clicked', async () => {
    const handleEdit = vi.fn();
    renderWithProviders(<UserTable users={mockUsers} onEdit={handleEdit} onDelete={() => {}} />);
    const editButtons = screen.getAllByLabelText('Edit');
    await userEvent.click(editButtons[0]);
    expect(handleEdit).toHaveBeenCalledWith(mockUsers[0]);
  });

  it('calls onDelete when delete button is clicked', async () => {
    const handleDelete = vi.fn();
    renderWithProviders(<UserTable users={mockUsers} onEdit={() => {}} onDelete={handleDelete} />);
    const deleteButtons = screen.getAllByLabelText('Delete');
    await userEvent.click(deleteButtons[1]);
    expect(handleDelete).toHaveBeenCalledWith(mockUsers[1]);
  });

  it('shows empty state when no users are provided', () => {
    renderWithProviders(<UserTable users={[]} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/no users found/i)).toBeInTheDocument();
  });
});
