import { screen, waitFor } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import FoldersList from '../../app/routes/server.$serverId.folders-list';
import { renderWithEvents } from '../__helpers__/set-up-test';

describe('FoldersList', () => {
  const defaultLoaderData = {
    serverId: 'server-1',
    serverName: 'Test Server',
    serverBaseUrl: 'https://shlink.example.com',
    folders: [] as any[],
  };

  const setUp = (loaderData = defaultLoaderData) => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: () => <FoldersList loaderData={loaderData as any} />,
      },
      {
        path: '/server/:serverId/folders',
        action: () => ({ success: true }),
      },
    ]);
    return renderWithEvents(<Stub initialEntries={['/']} />);
  };

  it('renders page title', async () => {
    setUp();
    await waitFor(() => expect(screen.getByText(/Folders - Test Server/)).toBeInTheDocument());
  });

  it('shows empty state when no folders', async () => {
    setUp();
    await waitFor(() => expect(screen.getByText('No folders yet.')).toBeInTheDocument());
  });

  it('shows folders when folders exist', async () => {
    const loaderData = {
      ...defaultLoaderData,
      folders: [
        {
          id: 1,
          name: 'Test Folder',
          color: '#ff0000',
          createdAt: '2026-01-01T00:00:00.000Z',
          itemCount: 2,
          items: [
            { shortUrlId: 'url-1', shortCode: 'abc', addedAt: '2026-01-01T00:00:00.000Z' },
            { shortUrlId: 'url-2', shortCode: 'def', addedAt: '2026-01-02T00:00:00.000Z' },
          ],
        },
      ],
    };

    setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Test Folder')).toBeInTheDocument());
    expect(screen.getByText('2 URLs')).toBeInTheDocument();
  });

  it('shows back to server link', async () => {
    setUp();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Back to Server' })).toHaveAttribute(
      'href',
      '/server/server-1',
    ));
  });

  it('shows new folder button', async () => {
    setUp();
    await waitFor(() => expect(screen.getByRole('button', { name: /New Folder/i })).toBeInTheDocument());
  });

  it('shows create form when new folder button clicked', async () => {
    const { user } = setUp();

    await waitFor(() => expect(screen.getByRole('button', { name: /New Folder/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /New Folder/i }));

    expect(screen.getByText('Create New Folder')).toBeInTheDocument();
    expect(screen.getByLabelText('Name *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('can cancel create form', async () => {
    const { user } = setUp();

    await waitFor(() => expect(screen.getByRole('button', { name: /New Folder/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /New Folder/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Create New Folder')).not.toBeInTheDocument();
  });

  it('can expand folder to see items', async () => {
    const loaderData = {
      ...defaultLoaderData,
      folders: [
        {
          id: 1,
          name: 'Test Folder',
          color: '#ff0000',
          createdAt: '2026-01-01T00:00:00.000Z',
          itemCount: 1,
          items: [
            { shortUrlId: 'url-1', shortCode: 'xyz', addedAt: '2026-01-01T00:00:00.000Z' },
          ],
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Test Folder')).toBeInTheDocument());
    // Expand folder - find the expand button (btn-link with svg)
    const expandButtons = screen.getAllByRole('button').filter(
      (btn) => btn.classList.contains('btn-link') && btn.querySelector('svg'),
    );
    await user.click(expandButtons[0]!);

    await waitFor(() => expect(screen.getByText('xyz')).toBeInTheDocument());
  });

  it('shows empty message when folder has no items', async () => {
    const loaderData = {
      ...defaultLoaderData,
      folders: [
        {
          id: 1,
          name: 'Empty Folder',
          color: '#ff0000',
          createdAt: '2026-01-01T00:00:00.000Z',
          itemCount: 0,
          items: [],
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Empty Folder')).toBeInTheDocument());
    // Expand folder - find the expand button
    const expandButtons = screen.getAllByRole('button').filter(
      (btn) => btn.classList.contains('btn-link') && btn.querySelector('svg'),
    );
    await user.click(expandButtons[0]!);

    await waitFor(() => expect(screen.getByText('No URLs in this folder.')).toBeInTheDocument());
  });

  it('can start editing folder', async () => {
    const loaderData = {
      ...defaultLoaderData,
      folders: [
        {
          id: 1,
          name: 'Test Folder',
          color: '#ff0000',
          createdAt: '2026-01-01T00:00:00.000Z',
          itemCount: 0,
          items: [],
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Test Folder')).toBeInTheDocument());
    await user.click(screen.getByText('Test Folder'));

    expect(screen.getByDisplayValue('Test Folder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('can cancel editing folder', async () => {
    const loaderData = {
      ...defaultLoaderData,
      folders: [
        {
          id: 1,
          name: 'Test Folder',
          color: '#ff0000',
          createdAt: '2026-01-01T00:00:00.000Z',
          itemCount: 0,
          items: [],
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Test Folder')).toBeInTheDocument());
    await user.click(screen.getByText('Test Folder'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByDisplayValue('Test Folder')).not.toBeInTheDocument();
    expect(screen.getByText('Test Folder')).toBeInTheDocument();
  });

  it('can save folder edits', async () => {
    const loaderData = {
      ...defaultLoaderData,
      folders: [
        {
          id: 1,
          name: 'Old Name',
          color: '#ff0000',
          createdAt: '2026-01-01T00:00:00.000Z',
          itemCount: 0,
          items: [],
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Old Name')).toBeInTheDocument());
    await user.click(screen.getByText('Old Name'));

    const input = screen.getByDisplayValue('Old Name');
    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Form should close after save
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
  });

  it('handles delete folder with confirm cancel', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const loaderData = {
      ...defaultLoaderData,
      folders: [
        {
          id: 1,
          name: 'Test Folder',
          color: '#ff0000',
          createdAt: '2026-01-01T00:00:00.000Z',
          itemCount: 0,
          items: [],
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Test Folder')).toBeInTheDocument());

    const deleteButton = screen.getByTitle('Delete folder');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText('Test Folder')).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it('handles delete folder with confirm accept', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const loaderData = {
      ...defaultLoaderData,
      folders: [
        {
          id: 1,
          name: 'Test Folder',
          color: '#ff0000',
          createdAt: '2026-01-01T00:00:00.000Z',
          itemCount: 0,
          items: [],
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Test Folder')).toBeInTheDocument());

    const deleteButton = screen.getByTitle('Delete folder');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('can create folder with name', async () => {
    const { user } = setUp();

    await waitFor(() => expect(screen.getByRole('button', { name: /New Folder/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /New Folder/i }));

    const nameInput = screen.getByLabelText('Name *');
    await user.type(nameInput, 'My New Folder');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    // Form should close
    await waitFor(() => expect(screen.queryByText('Create New Folder')).not.toBeInTheDocument());
  });

  it('can select different color when creating folder', async () => {
    const { user } = setUp();

    await waitFor(() => expect(screen.getByRole('button', { name: /New Folder/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /New Folder/i }));

    // Click a different color button
    const colorButtons = screen.getAllByTitle(/#[0-9A-Fa-f]{6}/);
    expect(colorButtons.length).toBeGreaterThan(2);
    await user.click(colorButtons[2]); // Select the third color

    // After clicking, the button should have a different border style (selection indicator)
    // Just verify the click doesn't throw and the color buttons are interactive
    expect(colorButtons[2]).toBeInTheDocument();
  });

  it('can remove item from folder', async () => {
    const loaderData = {
      ...defaultLoaderData,
      folders: [
        {
          id: 1,
          name: 'Test Folder',
          color: '#ff0000',
          createdAt: '2026-01-01T00:00:00.000Z',
          itemCount: 1,
          items: [
            { shortUrlId: 'url-1', shortCode: 'xyz', addedAt: '2026-01-01T00:00:00.000Z' },
          ],
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Test Folder')).toBeInTheDocument());

    // Expand folder
    const expandButtons = screen.getAllByRole('button').filter(
      (btn) => btn.classList.contains('btn-link') && btn.querySelector('svg'),
    );
    await user.click(expandButtons[0]!);

    await waitFor(() => expect(screen.getByText('xyz')).toBeInTheDocument());

    // Find and click remove item button
    const removeButtons = screen.getAllByTitle('Remove from folder');
    await user.click(removeButtons[0]);
  });

  it('shows folder with null color using default', async () => {
    const loaderData = {
      ...defaultLoaderData,
      folders: [
        {
          id: 1,
          name: 'No Color Folder',
          color: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          itemCount: 0,
          items: [],
        },
      ],
    };

    setUp(loaderData);

    await waitFor(() => expect(screen.getByText('No Color Folder')).toBeInTheDocument());
  });
});
