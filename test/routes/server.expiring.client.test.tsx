import { screen, waitFor } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import ExpiringUrls from '../../app/routes/server.$serverId.expiring';
import { renderWithEvents } from '../__helpers__/set-up-test';

describe('ExpiringUrls', () => {
  const defaultLoaderData = {
    serverId: 'server-1',
    serverName: 'Test Server',
    expiringUrls: [] as any[],
    error: undefined as string | undefined,
  };

  const setUp = (loaderData = defaultLoaderData) => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: () => <ExpiringUrls loaderData={loaderData as any} />,
      },
    ]);
    return renderWithEvents(<Stub initialEntries={['/']} />);
  };

  it('renders page title', async () => {
    setUp();
    await waitFor(() => expect(screen.getByText(/Expiring URLs - Test Server/)).toBeInTheDocument());
  });

  it('shows empty state when no expiring URLs', async () => {
    setUp();
    await waitFor(() => expect(screen.getByText('No URLs expiring in the next 30 days.')).toBeInTheDocument());
  });

  it('shows error message when error present', async () => {
    const loaderData = {
      ...defaultLoaderData,
      error: 'Failed to fetch URLs',
    };

    setUp(loaderData);

    await waitFor(() => expect(screen.getByText(/Error fetching URLs: Failed to fetch URLs/)).toBeInTheDocument());
  });

  it('shows expiring URLs table when URLs exist', async () => {
    const loaderData = {
      ...defaultLoaderData,
      expiringUrls: [
        {
          shortCode: 'abc123',
          title: 'Test URL',
          longUrl: 'https://example.com/long-url',
          validUntil: '2026-02-10T00:00:00.000Z',
          daysUntilExpiration: 5,
        },
      ],
    };

    setUp(loaderData);

    await waitFor(() => expect(screen.getByText('abc123')).toBeInTheDocument());
    expect(screen.getByText('Test URL')).toBeInTheDocument();
    expect(screen.getByText('5 days')).toBeInTheDocument();
  });

  it('shows singular "day" for 1 day left', async () => {
    const loaderData = {
      ...defaultLoaderData,
      expiringUrls: [
        {
          shortCode: 'xyz',
          title: null,
          longUrl: 'https://example.com',
          validUntil: '2026-02-05T00:00:00.000Z',
          daysUntilExpiration: 1,
        },
      ],
    };

    setUp(loaderData);

    await waitFor(() => expect(screen.getByText('1 day')).toBeInTheDocument());
  });

  it('shows danger badge for URLs expiring in 3 or fewer days', async () => {
    const loaderData = {
      ...defaultLoaderData,
      expiringUrls: [
        {
          shortCode: 'urgent',
          title: 'Urgent URL',
          longUrl: 'https://example.com',
          validUntil: '2026-02-06T00:00:00.000Z',
          daysUntilExpiration: 2,
        },
      ],
    };

    setUp(loaderData);

    await waitFor(() => {
      const badge = screen.getByText('2 days');
      expect(badge).toHaveClass('bg-danger');
    });
  });

  it('shows warning badge for URLs expiring in 4-7 days', async () => {
    const loaderData = {
      ...defaultLoaderData,
      expiringUrls: [
        {
          shortCode: 'warning',
          title: 'Warning URL',
          longUrl: 'https://example.com',
          validUntil: '2026-02-10T00:00:00.000Z',
          daysUntilExpiration: 5,
        },
      ],
    };

    setUp(loaderData);

    await waitFor(() => {
      const badge = screen.getByText('5 days');
      expect(badge).toHaveClass('bg-warning');
    });
  });

  it('shows info badge for URLs expiring in more than 7 days', async () => {
    const loaderData = {
      ...defaultLoaderData,
      expiringUrls: [
        {
          shortCode: 'normal',
          title: 'Normal URL',
          longUrl: 'https://example.com',
          validUntil: '2026-02-20T00:00:00.000Z',
          daysUntilExpiration: 15,
        },
      ],
    };

    setUp(loaderData);

    await waitFor(() => {
      const badge = screen.getByText('15 days');
      expect(badge).toHaveClass('bg-info');
    });
  });

  it('shows back to server link', async () => {
    setUp();
    await waitFor(() => expect(screen.getByRole('link', { name: /Back to Server/ })).toHaveAttribute(
      'href',
      '/server/server-1',
    ));
  });

  it('displays long URL without title', async () => {
    const loaderData = {
      ...defaultLoaderData,
      expiringUrls: [
        {
          shortCode: 'notitle',
          title: null,
          longUrl: 'https://example.com/very-long-url',
          validUntil: '2026-02-20T00:00:00.000Z',
          daysUntilExpiration: 10,
        },
      ],
    };

    setUp(loaderData);

    await waitFor(() => expect(screen.getByText('https://example.com/very-long-url')).toBeInTheDocument());
  });
});
