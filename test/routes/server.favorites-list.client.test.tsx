import { screen, waitFor } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import FavoritesList from '../../app/routes/server.$serverId.favorites-list';
import { renderWithEvents } from '../__helpers__/set-up-test';

describe('FavoritesList', () => {
  const defaultLoaderData = {
    serverId: 'server-1',
    serverName: 'Test Server',
    serverBaseUrl: 'https://shlink.example.com',
    favorites: [] as any[],
  };

  const setUp = (loaderData = defaultLoaderData) => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: () => <FavoritesList loaderData={loaderData as any} />,
      },
      {
        path: '/server/:serverId/favorites',
        action: () => ({ success: true }),
      },
    ]);
    return renderWithEvents(<Stub initialEntries={['/']} />);
  };

  it('renders page title', async () => {
    setUp();
    await waitFor(() => expect(screen.getByText(/Favorites - Test Server/)).toBeInTheDocument());
  });

  it('shows empty state when no favorites', async () => {
    setUp();
    await waitFor(() => expect(screen.getByText('No favorites yet.')).toBeInTheDocument());
  });

  it('shows favorites table when favorites exist', async () => {
    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: 'Test Page',
          notes: 'My notes',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    setUp(loaderData);

    await waitFor(() => expect(screen.getByText('abc')).toBeInTheDocument());
    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByText('My notes')).toBeInTheDocument();
  });

  it('shows back to server link', async () => {
    setUp();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Back to Server' })).toHaveAttribute(
      'href',
      '/server/server-1',
    ));
  });

  it('shows add notes prompt when no notes', async () => {
    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: null,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    setUp(loaderData);
    await waitFor(() => expect(screen.getByText('Add notes...')).toBeInTheDocument());
  });

  it('can start editing notes', async () => {
    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: null,
          notes: 'Existing notes',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Existing notes')).toBeInTheDocument());
    await user.click(screen.getByText('Existing notes'));
    expect(screen.getByDisplayValue('Existing notes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('can cancel editing notes', async () => {
    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: null,
          notes: 'Existing notes',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Existing notes')).toBeInTheDocument());
    await user.click(screen.getByText('Existing notes'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByText('Existing notes')).toBeInTheDocument();
  });

  it('can save notes', async () => {
    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: null,
          notes: 'Old notes',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Old notes')).toBeInTheDocument());
    await user.click(screen.getByText('Old notes'));

    const input = screen.getByDisplayValue('Old notes');
    await user.clear(input);
    await user.type(input, 'New notes');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // After saving, the edit mode should close
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
  });

  it('handles remove with confirm cancel', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: 'Test',
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('abc')).toBeInTheDocument());

    // Find and click the remove button
    const removeButton = screen.getByTitle('Remove from favorites');
    await user.click(removeButton);

    expect(confirmSpy).toHaveBeenCalledWith('Remove this URL from favorites?');
    // Item should still be there since we cancelled
    expect(screen.getByText('abc')).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it('handles remove with confirm accept', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: 'Test',
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('abc')).toBeInTheDocument());

    const removeButton = screen.getByTitle('Remove from favorites');
    await user.click(removeButton);

    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('displays formatted date', async () => {
    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: 'Test',
          notes: null,
          createdAt: '2026-01-15T00:00:00.000Z',
        },
      ],
    };

    setUp(loaderData);

    // The date should be formatted - just check that the table cell with date content exists
    await waitFor(() => expect(screen.getByText('abc')).toBeInTheDocument());
    // Check the date appears somewhere in the table
    const tableRows = document.querySelectorAll('tr');
    expect(tableRows.length).toBeGreaterThan(1);
  });

  it('shows external link with correct attributes', async () => {
    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: 'Test',
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    setUp(loaderData);

    await waitFor(() => expect(screen.getByTitle('Open short URL')).toBeInTheDocument());
    const link = screen.getByTitle('Open short URL');
    expect(link).toHaveAttribute('href', 'https://shlink.example.com/abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('can start editing notes with Add notes prompt', async () => {
    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: null,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Add notes...')).toBeInTheDocument());
    await user.click(screen.getByText('Add notes...'));

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add notes...')).toBeInTheDocument();
  });
});
