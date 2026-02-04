import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ExpiringUrls from '../../app/routes/server.$serverId.expiring';

describe('ExpiringUrls component', () => {
  const defaultLoaderData = {
    serverId: 'server-1',
    serverName: 'Test Server',
    expiringUrls: [] as any[],
  };

  const renderComponent = (loaderData: any = defaultLoaderData) => {
    return render(
      <MemoryRouter>
        <ExpiringUrls loaderData={loaderData} params={{ serverId: 'server-1' }} />
      </MemoryRouter>,
    );
  };

  it('renders empty state when no expiring URLs', () => {
    renderComponent();

    expect(screen.getByText('No URLs expiring in the next 30 days.')).toBeInTheDocument();
    expect(screen.getByText(/Expiring URLs - Test Server/)).toBeInTheDocument();
  });

  it('renders expiring URLs table', () => {
    const loaderData = {
      serverId: 'server-1',
      serverName: 'Test Server',
      expiringUrls: [
        {
          shortCode: 'abc',
          shortUrl: 'https://shlink.example.com/abc',
          longUrl: 'https://example.com/very-long-url',
          title: 'Example Page',
          validUntil: '2026-01-20T12:00:00Z',
          daysUntilExpiration: 5,
        },
      ],
    };

    renderComponent(loaderData);

    expect(screen.getByText('abc')).toBeInTheDocument();
    expect(screen.getByText('Example Page')).toBeInTheDocument();
    expect(screen.getByText('5 days')).toBeInTheDocument();
  });

  it('renders 1 day for single day remaining', () => {
    const loaderData = {
      serverId: 'server-1',
      serverName: 'Test Server',
      expiringUrls: [
        {
          shortCode: 'abc',
          shortUrl: 'https://shlink.example.com/abc',
          longUrl: 'https://example.com/page',
          title: null,
          validUntil: '2026-01-16T12:00:00Z',
          daysUntilExpiration: 1,
        },
      ],
    };

    renderComponent(loaderData);

    expect(screen.getByText('1 day')).toBeInTheDocument();
  });

  it('renders danger badge for 3 days or less', () => {
    const loaderData = {
      serverId: 'server-1',
      serverName: 'Test Server',
      expiringUrls: [
        {
          shortCode: 'abc',
          shortUrl: 'https://shlink.example.com/abc',
          longUrl: 'https://example.com/page',
          title: null,
          validUntil: '2026-01-17T12:00:00Z',
          daysUntilExpiration: 2,
        },
      ],
    };

    renderComponent(loaderData);

    const badge = screen.getByText('2 days');
    expect(badge.className).toContain('bg-danger');
  });

  it('renders warning badge for 4-7 days', () => {
    const loaderData = {
      serverId: 'server-1',
      serverName: 'Test Server',
      expiringUrls: [
        {
          shortCode: 'abc',
          shortUrl: 'https://shlink.example.com/abc',
          longUrl: 'https://example.com/page',
          title: null,
          validUntil: '2026-01-21T12:00:00Z',
          daysUntilExpiration: 6,
        },
      ],
    };

    renderComponent(loaderData);

    const badge = screen.getByText('6 days');
    expect(badge.className).toContain('bg-warning');
  });

  it('renders info badge for more than 7 days', () => {
    const loaderData = {
      serverId: 'server-1',
      serverName: 'Test Server',
      expiringUrls: [
        {
          shortCode: 'abc',
          shortUrl: 'https://shlink.example.com/abc',
          longUrl: 'https://example.com/page',
          title: null,
          validUntil: '2026-01-30T12:00:00Z',
          daysUntilExpiration: 15,
        },
      ],
    };

    renderComponent(loaderData);

    const badge = screen.getByText('15 days');
    expect(badge.className).toContain('bg-info');
  });

  it('renders error message when error is present', () => {
    const loaderData = {
      serverId: 'server-1',
      serverName: 'Test Server',
      expiringUrls: [],
      error: 'Failed to fetch URLs',
    };

    renderComponent(loaderData);

    expect(screen.getByText('Error fetching URLs: Failed to fetch URLs')).toBeInTheDocument();
  });

  it('renders back to server link', () => {
    renderComponent();

    const backLink = screen.getByText('Back to Server');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/server/server-1');
  });

  it('renders external link for each URL', () => {
    const loaderData = {
      serverId: 'server-1',
      serverName: 'Test Server',
      expiringUrls: [
        {
          shortCode: 'abc',
          shortUrl: 'https://shlink.example.com/abc',
          longUrl: 'https://example.com/page',
          title: 'Test',
          validUntil: '2026-01-20T12:00:00Z',
          daysUntilExpiration: 5,
        },
      ],
    };

    renderComponent(loaderData);

    const externalLink = screen.getByTitle('Open short URL');
    expect(externalLink).toHaveAttribute('href', 'https://shlink.example.com/abc');
    expect(externalLink).toHaveAttribute('target', '_blank');
    expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('handles URL without title', () => {
    const loaderData = {
      serverId: 'server-1',
      serverName: 'Test Server',
      expiringUrls: [
        {
          shortCode: 'abc',
          shortUrl: 'https://shlink.example.com/abc',
          longUrl: 'https://example.com/page',
          title: null,
          validUntil: '2026-01-20T12:00:00Z',
          daysUntilExpiration: 5,
        },
      ],
    };

    renderComponent(loaderData);

    expect(screen.getByText('https://example.com/page')).toBeInTheDocument();
  });
});
