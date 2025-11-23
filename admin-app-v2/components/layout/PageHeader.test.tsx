import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../tests/utils';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders title', () => {
    renderWithProviders(<PageHeader title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders description', () => {
    renderWithProviders(
      <PageHeader title="Dashboard" description="Overview of your system" />
    );
    expect(screen.getByText('Overview of your system')).toBeInTheDocument();
  });

  it('renders actions', () => {
    renderWithProviders(
      <PageHeader title="Users" actions={<button>Add User</button>} />
    );
    expect(screen.getByText('Add User')).toBeInTheDocument();
  });

  it('renders breadcrumbs', () => {
    const breadcrumbs = [
      { label: 'Home', href: '/' },
      { label: 'Dashboard' },
    ];
    renderWithProviders(<PageHeader title="Dashboard" breadcrumbs={breadcrumbs} />);
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    const dashboardElements = screen.getAllByText('Dashboard');
    expect(dashboardElements.length).toBeGreaterThan(0);
  });

  it('renders breadcrumbs with links', () => {
    const breadcrumbs = [
      { label: 'Home', href: '/' },
      { label: 'Users', href: '/users' },
      { label: 'Details' },
    ];
    renderWithProviders(<PageHeader title="User Details" breadcrumbs={breadcrumbs} />);
    
    const homeLink = screen.getByText('Home');
    expect(homeLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(
      <PageHeader title="Test" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders complete header with all props', () => {
    const breadcrumbs = [{ label: 'Home', href: '/' }, { label: 'Page' }];
    renderWithProviders(
      <PageHeader
        title="Test Page"
        description="Test description"
        breadcrumbs={breadcrumbs}
        actions={<button>Action</button>}
      />
    );

    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});
