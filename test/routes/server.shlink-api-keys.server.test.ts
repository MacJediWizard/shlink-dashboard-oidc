import { fromPartial } from '@total-typescript/shoehorn';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import type { ApiKeyRegistryService } from '../../app/api-keys/ApiKeyRegistryService.server';
import type { ShlinkApiKeyService } from '../../app/api-keys/ShlinkApiKeyService.server';
import { action, loader } from '../../app/routes/server.$serverId.shlink-api-keys';
import type { ServersService } from '../../app/servers/ServersService.server';

describe('server.$serverId.shlink-api-keys', () => {
  const mockSession = { publicId: 'user-1', username: 'testuser', role: 'admin' as const };
  const mockContext = {
    get: vi.fn().mockReturnValue(mockSession),
  };

  const mockServer = {
    publicId: 'server-1',
    name: 'Test Server',
    baseUrl: 'https://shlink.example.com',
    apiKey: 'api-key-123',
  };

  const getByPublicIdAndUser = vi.fn();
  const serversService = fromPartial<ServersService>({
    getByPublicIdAndUser,
  });

  const listApiKeys = vi.fn();
  const createApiKey = vi.fn();
  const deleteApiKey = vi.fn();
  const shlinkApiKeyService = fromPartial<ShlinkApiKeyService>({
    listApiKeys,
    createApiKey,
    deleteApiKey,
  });

  const createApiKeyRegistry = vi.fn();
  const apiKeyRegistryService = fromPartial<ApiKeyRegistryService>({
    createApiKey: createApiKeyRegistry,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getByPublicIdAndUser.mockResolvedValue(mockServer);
  });

  describe('loader', () => {
    it('returns 400 when serverId is missing', async () => {
      const args = fromPartial<LoaderFunctionArgs>({
        params: {},
        context: mockContext,
      });

      const response = await loader(args, serversService, shlinkApiKeyService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Server ID required');
    });

    it('returns API keys from Shlink', async () => {
      const shlinkApiKeys = [
        {
          key: 'abcd-1234-5678-efgh',
          name: 'Test Key',
          expirationDate: '2026-12-31',
          roles: [{ authKey: 'key', roleName: 'ADMIN_API_KEY' }],
        },
      ];
      listApiKeys.mockResolvedValue(shlinkApiKeys);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const response = await loader(args, serversService, shlinkApiKeyService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.apiKeys).toHaveLength(1);
      expect(data.apiKeys[0].name).toBe('Test Key');
      expect(data.apiKeys[0].keyHint).toBe('efgh');
      expect(getByPublicIdAndUser).toHaveBeenCalledWith('server-1', 'user-1');
      expect(listApiKeys).toHaveBeenCalledWith(mockServer);
    });

    it('returns 500 when Shlink API fails', async () => {
      listApiKeys.mockRejectedValue(new Error('API error'));

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const response = await loader(args, serversService, shlinkApiKeyService);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('API error');
    });

    it('returns generic error message for non-Error throws', async () => {
      listApiKeys.mockRejectedValue('Unknown error');

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const response = await loader(args, serversService, shlinkApiKeyService);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch API keys');
    });
  });

  describe('action', () => {
    it('returns 400 when serverId is missing', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: {},
        context: mockContext,
        request: { json: vi.fn().mockResolvedValue({}) },
      });

      const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Server ID required');
    });

    it('returns 404 when server not found', async () => {
      getByPublicIdAndUser.mockRejectedValue(new Error('Not found'));

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'invalid-server' },
        context: mockContext,
        request: { json: vi.fn().mockResolvedValue({ action: 'create' }) },
      });

      const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Server not found');
    });

    describe('create action', () => {
      it('creates an API key in Shlink without dashboard registration', async () => {
        const shlinkApiKey = {
          key: 'new-key-1234-5678',
          name: 'New Key',
          expirationDate: '2026-12-31',
          roles: [],
        };
        createApiKey.mockResolvedValue(shlinkApiKey);

        const args = fromPartial<ActionFunctionArgs>({
          params: { serverId: 'server-1' },
          context: mockContext,
          request: {
            json: vi.fn().mockResolvedValue({
              action: 'create',
              name: 'New Key',
              expirationDate: '2026-12-31',
              roles: [],
              registerInDashboard: false,
            }),
          },
        });

        const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.apiKey.key).toBe('new-key-1234-5678');
        expect(data.registryEntry).toBeNull();
        expect(createApiKeyRegistry).not.toHaveBeenCalled();
      });

      it('creates an API key and registers in dashboard', async () => {
        const shlinkApiKey = {
          key: 'new-key-1234-5678',
          name: 'New Key',
          expirationDate: '2026-12-31',
          roles: [],
        };
        const registryEntry = {
          id: '1',
          name: 'New Key',
          keyHint: '5678',
          service: 'n8n',
        };
        createApiKey.mockResolvedValue(shlinkApiKey);
        createApiKeyRegistry.mockResolvedValue(registryEntry);

        const args = fromPartial<ActionFunctionArgs>({
          params: { serverId: 'server-1' },
          context: mockContext,
          request: {
            json: vi.fn().mockResolvedValue({
              action: 'create',
              name: 'New Key',
              expirationDate: '2026-12-31',
              roles: [],
              registerInDashboard: true,
              service: 'n8n',
              tags: ['automation'],
              notes: 'Test notes',
            }),
          },
        });

        const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.registryEntry).not.toBeNull();
        expect(data.registryEntry.id).toBe('1');
        expect(createApiKeyRegistry).toHaveBeenCalled();
      });

      it('uses default values when name/service not provided', async () => {
        const shlinkApiKey = {
          key: 'new-key-1234-5678',
          name: null,
          expirationDate: null,
          roles: [],
        };
        const registryEntry = {
          id: '1',
          name: expect.stringContaining('Generated'),
          keyHint: '5678',
          service: 'dashboard',
        };
        createApiKey.mockResolvedValue(shlinkApiKey);
        createApiKeyRegistry.mockResolvedValue(registryEntry);

        const args = fromPartial<ActionFunctionArgs>({
          params: { serverId: 'server-1' },
          context: mockContext,
          request: {
            json: vi.fn().mockResolvedValue({
              action: 'create',
              registerInDashboard: true,
            }),
          },
        });

        const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it('returns 500 when Shlink create fails', async () => {
        createApiKey.mockRejectedValue(new Error('Failed to create'));

        const args = fromPartial<ActionFunctionArgs>({
          params: { serverId: 'server-1' },
          context: mockContext,
          request: {
            json: vi.fn().mockResolvedValue({
              action: 'create',
              name: 'New Key',
            }),
          },
        });

        const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to create');
      });

      it('returns generic error for non-Error throws in create', async () => {
        createApiKey.mockRejectedValue('Unknown error');

        const args = fromPartial<ActionFunctionArgs>({
          params: { serverId: 'server-1' },
          context: mockContext,
          request: {
            json: vi.fn().mockResolvedValue({
              action: 'create',
              name: 'New Key',
            }),
          },
        });

        const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to create API key');
      });
    });

    describe('delete action', () => {
      it('deletes an API key', async () => {
        deleteApiKey.mockResolvedValue(true);

        const args = fromPartial<ActionFunctionArgs>({
          params: { serverId: 'server-1' },
          context: mockContext,
          request: {
            json: vi.fn().mockResolvedValue({
              action: 'delete',
              apiKey: 'key-to-delete',
            }),
          },
        });

        const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(deleteApiKey).toHaveBeenCalledWith(mockServer, 'key-to-delete');
      });

      it('returns 400 when apiKey is missing', async () => {
        const args = fromPartial<ActionFunctionArgs>({
          params: { serverId: 'server-1' },
          context: mockContext,
          request: {
            json: vi.fn().mockResolvedValue({
              action: 'delete',
            }),
          },
        });

        const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('API key required');
      });

      it('returns 404 when key not found', async () => {
        deleteApiKey.mockResolvedValue(false);

        const args = fromPartial<ActionFunctionArgs>({
          params: { serverId: 'server-1' },
          context: mockContext,
          request: {
            json: vi.fn().mockResolvedValue({
              action: 'delete',
              apiKey: 'nonexistent-key',
            }),
          },
        });

        const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('API key not found');
      });

      it('returns 500 when delete fails', async () => {
        deleteApiKey.mockRejectedValue(new Error('Delete failed'));

        const args = fromPartial<ActionFunctionArgs>({
          params: { serverId: 'server-1' },
          context: mockContext,
          request: {
            json: vi.fn().mockResolvedValue({
              action: 'delete',
              apiKey: 'key-to-delete',
            }),
          },
        });

        const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Delete failed');
      });

      it('returns generic error for non-Error throws in delete', async () => {
        deleteApiKey.mockRejectedValue('Unknown error');

        const args = fromPartial<ActionFunctionArgs>({
          params: { serverId: 'server-1' },
          context: mockContext,
          request: {
            json: vi.fn().mockResolvedValue({
              action: 'delete',
              apiKey: 'key-to-delete',
            }),
          },
        });

        const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to delete API key');
      });
    });

    it('returns 400 for invalid action', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({ action: 'invalid' }),
        },
      });

      const response = await action(args, serversService, shlinkApiKeyService, apiKeyRegistryService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });
  });
});
