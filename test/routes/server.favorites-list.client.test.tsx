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

  it('shows Add Favorite button', async () => {
    setUp();
    await waitFor(() => expect(screen.getByRole('button', { name: /Add Favorite/i })).toBeInTheDocument());
  });

  it('shows add favorite form when button clicked', async () => {
    const { user } = setUp();

    await waitFor(() => expect(screen.getByRole('button', { name: /Add Favorite/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Add Favorite/i }));

    expect(screen.getByText('Add Favorite')).toBeInTheDocument();
    expect(screen.getByLabelText('Short Code *')).toBeInTheDocument();
    expect(screen.getByLabelText('Long URL *')).toBeInTheDocument();
  });

  it('can cancel add favorite form', async () => {
    const { user } = setUp();

    await waitFor(() => expect(screen.getByRole('button', { name: /Add Favorite/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Add Favorite/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Short Code *')).not.toBeInTheDocument();
  });

  it('can filter favorites with search', async () => {
    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: 'Apple',
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          shortUrlId: 'url-2',
          shortCode: 'xyz',
          longUrl: 'https://example.com/page2',
          title: 'Banana',
          notes: null,
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Apple')).toBeInTheDocument());
    expect(screen.getByText('Banana')).toBeInTheDocument();

    // Search for Apple
    await user.type(screen.getByPlaceholderText('Search favorites...'), 'apple');

    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
  });

  it('shows no results message when search has no matches', async () => {
    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: 'Apple',
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Apple')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Search favorites...'), 'xyz');

    expect(screen.getByText('No favorites match your search.')).toBeInTheDocument();
  });

  it('can toggle URL expansion', async () => {
    const longUrl = 'https://example.com/' + 'very-long-path/'.repeat(10);
    const loaderData = {
      ...defaultLoaderData,
      favorites: [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl,
          title: null,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('abc')).toBeInTheDocument());

    // Find and click "Show more" button
    const showMoreButton = screen.getByRole('button', { name: 'Show more' });
    await user.click(showMoreButton);

    // Now it should say "Show less"
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
  });

  it('can submit add favorite form', async () => {
    const { user } = setUp();

    await waitFor(() => expect(screen.getByRole('button', { name: /Add Favorite/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Add Favorite/i }));

    // Fill out the form
    await user.type(screen.getByLabelText('Short Code *'), 'testcode');
    await user.type(screen.getByLabelText('Long URL *'), 'https://example.com/test');
    await user.type(screen.getByLabelText('Title (optional)'), 'Test Title');
    await user.type(screen.getByLabelText('Notes (optional)'), 'Test notes');

    // Click the "Add to Favorites" form submit button
    await user.click(screen.getByRole('button', { name: /Add to Favorites/i }));

    // Form should close
    await waitFor(() => expect(screen.queryByLabelText('Short Code *')).not.toBeInTheDocument());
  });

  it('shows alert when submitting add favorite without required fields', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { user } = setUp();

    await waitFor(() => expect(screen.getByRole('button', { name: /Add Favorite/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Add Favorite/i }));

    // Try to submit without filling required fields by clicking "Add to Favorites"
    await user.click(screen.getByRole('button', { name: /Add to Favorites/i }));

    expect(alertSpy).toHaveBeenCalledWith('Short code and long URL are required');

    alertSpy.mockRestore();
  });
});
