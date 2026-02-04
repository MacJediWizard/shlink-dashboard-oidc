import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AuditLog from '../../../app/routes/admin/audit-log';

describe('AuditLog component', () => {
  const defaultLoaderData = {
    logs: [] as any[],
    pagination: {
      currentPage: 1,
      pagesCount: 1,
      totalItems: 0,
    },
  };

  const renderComponent = (loaderData: any = defaultLoaderData) => {
    return render(
      <MemoryRouter>
        <AuditLog loaderData={loaderData} params={{}} />
      </MemoryRouter>,
    );
  };

  it('renders empty state when no logs', () => {
    renderComponent();

    expect(screen.getByText('No audit log entries found.')).toBeInTheDocument();
  });

  it('renders logs table when logs exist', () => {
    const loaderData = {
      logs: [
        {
          id: '1',
          action: 'login',
          resourceType: null,
          resourceId: null,
          details: null,
          ipAddress: '192.168.1.1',
          createdAt: '2026-01-15T10:30:00.000Z',
          username: 'testuser',
          serverName: null,
        },
      ],
      pagination: {
        currentPage: 1,
        pagesCount: 1,
        totalItems: 1,
      },
    };

    renderComponent(loaderData);

    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
  });

  it('renders formatted action names', () => {
    const loaderData = {
      logs: [
        {
          id: '1',
          action: 'create_short_url',
          resourceType: 'short_url',
          resourceId: 'abc123',
          details: null,
          ipAddress: null,
          createdAt: '2026-01-15T10:30:00.000Z',
          username: 'admin',
          serverName: 'Production',
        },
      ],
      pagination: {
        currentPage: 1,
        pagesCount: 1,
        totalItems: 1,
      },
    };

    renderComponent(loaderData);

    expect(screen.getByText('Create Short Url')).toBeInTheDocument();
    expect(screen.getByText('short_url: abc123')).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders dash for null values', () => {
    const loaderData = {
      logs: [
        {
          id: '1',
          action: 'logout',
          resourceType: null,
          resourceId: null,
          details: null,
          ipAddress: null,
          createdAt: '2026-01-15T10:30:00.000Z',
          username: 'System',
          serverName: null,
        },
      ],
      pagination: {
        currentPage: 1,
        pagesCount: 1,
        totalItems: 1,
      },
    };

    renderComponent(loaderData);

    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders resource type without id as N/A', () => {
    const loaderData = {
      logs: [
        {
          id: '1',
          action: 'delete_user',
          resourceType: 'user',
          resourceId: null,
          details: null,
          ipAddress: '10.0.0.1',
          createdAt: '2026-01-15T10:30:00.000Z',
          username: 'admin',
          serverName: null,
        },
      ],
      pagination: {
        currentPage: 1,
        pagesCount: 1,
        totalItems: 1,
      },
    };

    renderComponent(loaderData);

    expect(screen.getByText('user: N/A')).toBeInTheDocument();
  });

  it('renders pagination when multiple pages', () => {
    const loaderData = {
      logs: [
        {
          id: '1',
          action: 'login',
          resourceType: null,
          resourceId: null,
          details: null,
          ipAddress: '192.168.1.1',
          createdAt: '2026-01-15T10:30:00.000Z',
          username: 'testuser',
          serverName: null,
        },
      ],
      pagination: {
        currentPage: 1,
        pagesCount: 5,
        totalItems: 125,
      },
    };

    renderComponent(loaderData);

    // The Paginator component should render page links
    expect(screen.getByLabelText('Next')).toBeInTheDocument();
  });
});
