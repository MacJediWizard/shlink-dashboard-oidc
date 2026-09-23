import { screen, waitFor } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import type { Pixel } from '../../app/pixels/PixelsService.server';
import Pixels from '../../app/routes/server.$serverId.pixels';
import { renderWithEvents } from '../__helpers__/set-up-test';

describe('Pixels', () => {
  const pixel: Pixel = {
    shortCode: 'sig-open',
    domain: 'go.test',
    shortUrl: 'https://go.test/sig-open',
    pixelUrl: 'https://go.test/sig-open/track',
    name: 'Email signature',
    fallbackUrl: 'https://example.com',
    dateCreated: '2026-09-01T10:00:00+00:00',
    opens: 42,
    botHits: 7,
    opensLast7Days: 5,
    lastOpened: '2026-09-20T08:00:00+00:00',
  };
  const defaultLoaderData = {
    serverId: 'server-1',
    serverName: 'Test Server',
    pixels: [] as Pixel[],
    domains: [
      { domain: 's.test', isDefault: true },
      { domain: 'go.test', isDefault: false },
    ],
    error: undefined as string | undefined,
  };

  const setUp = (loaderData: Partial<typeof defaultLoaderData> = {}) => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: () => <Pixels loaderData={{ ...defaultLoaderData, ...loaderData } as any} params={{} as any} />,
      },
    ]);
    return renderWithEvents(<Stub initialEntries={['/']} />);
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows empty state when there are no pixels', async () => {
    setUp();
    await waitFor(() => expect(screen.getByText('No pixels yet')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Create pixel/ })).toBeInTheDocument();
  });

  it('shows errors instead of the page content', async () => {
    setUp({ error: 'Invalid API key' });
    await waitFor(() => expect(screen.getByText('Invalid API key')).toBeInTheDocument());
    expect(screen.queryByText('No pixels yet')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument();
  });

  it('lists pixels with their stats and totals', async () => {
    setUp({
      pixels: [
        pixel,
        {
          ...pixel,
          shortCode: 'other',
          pixelUrl: 'https://go.test/other/track',
          name: 'Newsletter',
          opens: 8,
          botHits: 1,
        },
      ],
    });

    await waitFor(() => expect(screen.getByText('Email signature')).toBeInTheDocument());
    expect(screen.getByText('Newsletter')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument(); // Total opens
    expect(screen.getByText('https://go.test/sig-open/track')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'View visits' })[0]).toHaveAttribute(
      'href',
      '/server/server-1/short-code/sig-open/visits?domain=go.test',
    );
  });

  it('shows pixels never opened', async () => {
    setUp({ pixels: [{ ...pixel, lastOpened: null }] });
    await waitFor(() => expect(screen.getByText('Never')).toBeInTheDocument());
  });

  it('validates custom slugs as the user types', async () => {
    const { user } = setUp();

    await user.type(screen.getByLabelText(/^Custom slug/), 'admin-sig');

    expect(screen.getByText(/cannot use "admin"/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create pixel/ })).toBeDisabled();
  });

  it('remembers the last used domain and fallback URL', async () => {
    window.localStorage.setItem('shlink-dashboard.pixels.domain', 'go.test');
    window.localStorage.setItem('shlink-dashboard.pixels.fallbackUrl', 'https://remembered.test');
    setUp();

    await waitFor(() => expect(screen.getByLabelText(/^Domain/)).toHaveValue('go.test'));
    expect(screen.getByLabelText(/^Fallback URL/)).toHaveValue('https://remembered.test');
  });

  it('ignores a remembered domain that no longer exists', async () => {
    window.localStorage.setItem('shlink-dashboard.pixels.domain', 'gone.test');
    setUp();
    await waitFor(() => expect(screen.getByLabelText(/^Domain/)).toHaveValue('s.test'));
  });

  it('copies the HTML snippet', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const { user } = setUp({ pixels: [pixel] });

    await user.click(await screen.findByRole('button', { name: 'Copy HTML snippet' }));

    expect(writeText).toHaveBeenCalledWith(
      '<img src="https://go.test/sig-open/track" width="1" height="1" alt="" style="display:none;border:0;" />',
    );
  });

  it('enters and leaves rename mode', async () => {
    const { user } = setUp({ pixels: [pixel] });

    await user.click(await screen.findByRole('button', { name: 'Rename' }));
    expect(screen.getByLabelText(/Pixel name/)).toHaveValue('Email signature');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText(/Pixel name/)).not.toBeInTheDocument();
  });

  it('asks for confirmation before deleting', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = setUp({ pixels: [pixel] });

    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(confirm).toHaveBeenCalledWith('Delete pixel "Email signature"? Its visits will be deleted too.');
  });
});
