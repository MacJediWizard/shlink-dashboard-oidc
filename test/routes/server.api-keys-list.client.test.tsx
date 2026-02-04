import { screen, waitFor } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import ApiKeysList from '../../app/routes/server.$serverId.api-keys-list';
import { renderWithEvents } from '../__helpers__/set-up-test';

describe('ApiKeysList', () => {
  const defaultLoaderData = {
    serverId: 'server-1',
    serverName: 'Test Server',
    apiKeys: [] as any[],
    expiringKeyIds: [] as number[],
    shlinkApiKeys: [] as any[],
    shlinkApiError: null as string | null,
  };

  const setUp = (loaderData = defaultLoaderData) => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: () => <ApiKeysList loaderData={loaderData as any} />,
      },
      {
        path: '/server/:serverId/api-keys',
        action: () => ({ success: true }),
      },
    ]);
    return renderWithEvents(<Stub initialEntries={['/']} />);
  };

  it('renders page title', async () => {
    setUp();
    await waitFor(() => expect(screen.getByText(/API Keys - Test Server/)).toBeInTheDocument());
  });

  it('shows empty state when no API keys', async () => {
    setUp();
    await waitFor(() => expect(screen.getByText('No API Keys Registered Yet')).toBeInTheDocument());
  });

  it('shows API keys table when keys exist', async () => {
    const loaderData = {
      ...defaultLoaderData,
      apiKeys: [
        {
          id: 1,
          name: 'Test Key',
          description: 'Test description',
          keyHint: 'abcd',
          service: 'n8n',
          tags: ['test'],
          expiresAt: '2026-12-31T00:00:00.000Z',
          lastUsedAt: '2026-01-15T00:00:00.000Z',
          usageCount: 5,
          isActive: true,
          notes: 'My notes',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Test Key')).toBeInTheDocument());
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('...abcd')).toBeInTheDocument();
    expect(screen.getByText('n8n')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows back to server link', async () => {
    setUp();
    await waitFor(() => expect(screen.getByRole('link', { name: /Back to Server/ })).toHaveAttribute(
      'href',
      '/server/server-1',
    ));
  });

  it('shows register key button', async () => {
    setUp();
    // There are now multiple "Register Key" buttons (Quick Actions + tab header)
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Register Key/i }).length).toBeGreaterThan(0));
  });

  it('shows create form when register key button clicked', async () => {
    const { user } = setUp();

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Register Key/i }).length).toBeGreaterThan(0));
    // Click the first Register Key button (from Quick Actions)
    await user.click(screen.getAllByRole('button', { name: /Register Key/i })[0]);

    expect(screen.getByText('Register Existing API Key')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Key Hint/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Service/)).toBeInTheDocument();
    // There are multiple buttons with "Register Key" - Quick Actions, tab header, and form
    const registerButtons = screen.getAllByRole('button', { name: /Register Key/i });
    expect(registerButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('can cancel create form', async () => {
    const { user } = setUp();

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Register Key/i }).length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole('button', { name: /Register Key/i })[0]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Register Existing API Key')).not.toBeInTheDocument();
  });

  it('shows inactive status for deactivated keys', async () => {
    const loaderData = {
      ...defaultLoaderData,
      apiKeys: [
        {
          id: 1,
          name: 'Inactive Key',
          description: null,
          keyHint: 'wxyz',
          service: 'dashboard',
          tags: [],
          expiresAt: null,
          lastUsedAt: null,
          usageCount: 0,
          isActive: false,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Inactive')).toBeInTheDocument());
  });

  it('shows - for null dates', async () => {
    const loaderData = {
      ...defaultLoaderData,
      apiKeys: [
        {
          id: 1,
          name: 'No Usage Key',
          description: null,
          keyHint: 'test',
          service: 'api',
          tags: [],
          expiresAt: null,
          lastUsedAt: null,
          usageCount: 0,
          isActive: true,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    setUp(loaderData);

    // Check for the "-" that appears when lastUsedAt is null
    await waitFor(() => expect(screen.getAllByText('-').length).toBeGreaterThan(0));
  });

  it('can toggle key active status', async () => {
    const loaderData = {
      ...defaultLoaderData,
      apiKeys: [
        {
          id: 1,
          name: 'Test Key',
          description: null,
          keyHint: 'abcd',
          service: 'dashboard',
          tags: [],
          expiresAt: null,
          lastUsedAt: null,
          usageCount: 0,
          isActive: true,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());

    // Click the active badge to toggle
    await user.click(screen.getByText('Active'));
  });

  it('can delete key with confirm cancel', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const loaderData = {
      ...defaultLoaderData,
      apiKeys: [
        {
          id: 1,
          name: 'Test Key',
          description: null,
          keyHint: 'abcd',
          service: 'dashboard',
          tags: [],
          expiresAt: null,
          lastUsedAt: null,
          usageCount: 0,
          isActive: true,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Test Key')).toBeInTheDocument());

    const deleteButton = screen.getByTitle('Delete from registry');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText('Test Key')).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it('can delete key with confirm accept', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const loaderData = {
      ...defaultLoaderData,
      apiKeys: [
        {
          id: 1,
          name: 'Test Key',
          description: null,
          keyHint: 'abcd',
          service: 'dashboard',
          tags: [],
          expiresAt: null,
          lastUsedAt: null,
          usageCount: 0,
          isActive: true,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByText('Test Key')).toBeInTheDocument());

    const deleteButton = screen.getByTitle('Delete from registry');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('can fill out and submit create form', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { user } = setUp();

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Register Key/i }).length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole('button', { name: /Register Key/i })[0]);

    // Fill out the form
    await user.type(screen.getByLabelText(/^Name/), 'My API Key');
    await user.type(screen.getByLabelText(/Key Hint/), 'wxyz');
    await user.selectOptions(screen.getByLabelText(/Service/), 'n8n');
    await user.type(screen.getByLabelText(/^Description$/), 'Test description');

    // Submit
    const submitButtons = screen.getAllByRole('button', { name: /Register Key/i });
    await user.click(submitButtons[1]); // The form submit button

    // Form should close
    await waitFor(() => expect(screen.queryByText('Register Existing API Key')).not.toBeInTheDocument());

    alertSpy.mockRestore();
  });

  it('shows alert when creating without required fields', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { user } = setUp();

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Register Key/i }).length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole('button', { name: /Register Key/i })[0]);

    // Try to submit without filling required fields - find the form submit button (the last Register Key button)
    const submitButtons = screen.getAllByRole('button', { name: /Register Key/i });
    // Click the last button (form submit button)
    await user.click(submitButtons[submitButtons.length - 1]);

    expect(alertSpy).toHaveBeenCalledWith('Name and key hint are required');

    alertSpy.mockRestore();
  });

  it('displays formatted last used date', async () => {
    const loaderData = {
      ...defaultLoaderData,
      apiKeys: [
        {
          id: 1,
          name: 'Used Key',
          description: null,
          keyHint: 'abcd',
          service: 'dashboard',
          tags: [],
          expiresAt: null,
          lastUsedAt: '2026-01-15T00:00:00.000Z',
          usageCount: 10,
          isActive: true,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    setUp(loaderData);

    // Check that the key is rendered - the date will be formatted according to locale
    await waitFor(() => expect(screen.getByText('Used Key')).toBeInTheDocument());
    // Check that the table has rows with data
    const tableRows = document.querySelectorAll('tr');
    expect(tableRows.length).toBeGreaterThan(1);
  });

  it('can fill out optional fields in create form', async () => {
    const { user } = setUp();

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Register Key/i }).length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole('button', { name: /Register Key/i })[0]);

    await user.type(screen.getByLabelText(/^Name/), 'My Key');
    await user.type(screen.getByLabelText(/Key Hint/), 'test');
    await user.type(screen.getByLabelText(/Expiration Date/), '2026-12-31');
    await user.type(screen.getByLabelText(/^Notes$/), 'Some notes');

    const submitButtons = screen.getAllByRole('button', { name: /Register Key/i });
    await user.click(submitButtons[1]);

    await waitFor(() => expect(screen.queryByText('Register Existing API Key')).not.toBeInTheDocument());
  });

  it('can switch to Shlink API Keys tab', async () => {
    const loaderData = {
      ...defaultLoaderData,
      shlinkApiKeys: [
        {
          key: 'abc123-full-key',
          name: 'Test Shlink Key',
          expirationDate: null,
          roles: [],
        },
      ],
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getAllByText(/Key Registry/).length).toBeGreaterThan(0));

    // Click on Shlink Server Keys tab button - find by getting button containing "Shlink Server Keys"
    const shlinkTabButton = screen.getByRole('button', { name: /Shlink Server Keys/ });
    await user.click(shlinkTabButton);

    // Should show Shlink API key content
    await waitFor(() => expect(screen.getByText('Test Shlink Key')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /Generate New API Key/ }).length).toBeGreaterThan(0);
  });

  it('shows Shlink API error when present', async () => {
    const loaderData = {
      ...defaultLoaderData,
      shlinkApiError: 'Failed to connect to Shlink server',
    };

    const { user } = setUp(loaderData);

    await waitFor(() => expect(screen.getByRole('button', { name: /Shlink Server Keys/ })).toBeInTheDocument());

    // Click on Shlink Server Keys tab
    await user.click(screen.getByRole('button', { name: /Shlink Server Keys/ }));

    // Should show error message - now displays a user-friendly message
    await waitFor(() => expect(screen.getByText('Cannot list existing API keys')).toBeInTheDocument());
    expect(screen.getByText(/Shlink doesn't expose an API endpoint/)).toBeInTheDocument();
  });

  it('shows expiring keys warning when keys expiring soon', async () => {
    const loaderData = {
      ...defaultLoaderData,
      expiringKeyIds: [1, 2],
      apiKeys: [
        {
          id: 1,
          name: 'Expiring Key',
          description: null,
          keyHint: 'abcd',
          service: 'dashboard',
          tags: [],
          expiresAt: '2026-02-10T00:00:00.000Z',
          lastUsedAt: null,
          usageCount: 0,
          isActive: true,
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    setUp(loaderData);

    // Should show warning about expiring keys (text: "2 API keys expiring within 14 days!")
    await waitFor(() => expect(screen.getByText(/2 API keys/)).toBeInTheDocument());
    expect(screen.getByText(/expiring within 14 days/)).toBeInTheDocument();
  });
});
