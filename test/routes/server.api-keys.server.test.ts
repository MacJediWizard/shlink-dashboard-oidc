import { fromPartial } from '@total-typescript/shoehorn';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import type { ApiKeyRegistryService } from '../../app/api-keys/ApiKeyRegistryService.server';
import { action, loader } from '../../app/routes/server.$serverId.api-keys';

describe('server.$serverId.api-keys', () => {
  const mockSession = { publicId: 'user-1', username: 'testuser', role: 'admin' as const };
  const mockContext = {
    get: vi.fn().mockReturnValue(mockSession),
  };

  const getApiKeys = vi.fn();
  const createApiKey = vi.fn();
  const updateApiKey = vi.fn();
  const deleteApiKey = vi.fn();
  const recordUsage = vi.fn();
  const getExpiringSoon = vi.fn();
  const getByService = vi.fn();
  const apiKeyService = fromPartial<ApiKeyRegistryService>({
    getApiKeys,
    createApiKey,
    updateApiKey,
    deleteApiKey,
    recordUsage,
    getExpiringSoon,
    getByService,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loader', () => {
    it('returns 400 when serverId is missing', async () => {
      const args = fromPartial<LoaderFunctionArgs>({
        params: {},
        context: mockContext,
      });

      const response = await loader(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Server ID required');
    });

    it('returns API keys for user and server', async () => {
      const apiKeys = [
        {
          id: 1,
          name: 'Key 1',
          description: 'Test',
          keyHint: 'abcd',
          service: 'dashboard',
          tags: [],
          expiresAt: null,
          lastUsedAt: null,
          usageCount: 0,
          isActive: true,
          notes: null,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ];
      getApiKeys.mockResolvedValue(apiKeys);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const response = await loader(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.apiKeys).toHaveLength(1);
      expect(data.apiKeys[0].name).toBe('Key 1');
    });
  });

  describe('action', () => {
    it('returns 400 when serverId is missing', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: {},
        context: mockContext,
        request: { json: vi.fn().mockResolvedValue({}) },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Server ID required');
    });

    it('creates an API key', async () => {
      const apiKey = {
        id: 1,
        name: 'New Key',
        description: 'Test',
        keyHint: 'abcd',
        service: 'n8n',
        tags: ['test'],
        expiresAt: null,
        lastUsedAt: null,
        usageCount: 0,
        isActive: true,
        notes: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      };
      createApiKey.mockResolvedValue(apiKey);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'create',
            name: 'New Key',
            keyHint: 'abcd',
            service: 'n8n',
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.apiKey.name).toBe('New Key');
    });

    it('updates an API key', async () => {
      const apiKey = {
        id: 1,
        name: 'Updated Key',
        description: 'Test',
        keyHint: 'abcd',
        service: 'n8n',
        tags: [],
        expiresAt: null,
        lastUsedAt: null,
        usageCount: 0,
        isActive: false,
        notes: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      };
      updateApiKey.mockResolvedValue(apiKey);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'update',
            id: '1',
            name: 'Updated Key',
            isActive: false,
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('deletes an API key', async () => {
      deleteApiKey.mockResolvedValue(true);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'delete',
            id: '1',
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('records usage', async () => {
      recordUsage.mockResolvedValue(true);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'recordUsage',
            id: '1',
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 400 for invalid action', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({ action: 'invalid' }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });

    it('returns 400 when create is missing required fields', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'create',
            name: 'Test',
            // Missing keyHint and service
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Name, key hint, and service are required');
    });

    it('returns 400 when update is missing id', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'update',
            name: 'New Name',
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key ID required');
    });

    it('returns 404 when update key not found', async () => {
      updateApiKey.mockResolvedValue(null);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'update',
            id: 'nonexistent',
            name: 'New Name',
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('API key not found');
    });

    it('returns 400 when delete is missing id', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'delete',
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key ID required');
    });

    it('returns 404 when delete key not found', async () => {
      deleteApiKey.mockResolvedValue(false);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'delete',
            id: 'nonexistent',
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('API key not found');
    });

    it('returns 400 when recordUsage is missing id', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'recordUsage',
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('API key ID required');
    });

    it('returns 404 when recordUsage key not found', async () => {
      recordUsage.mockResolvedValue(false);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'recordUsage',
            id: 'nonexistent',
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('API key not found');
    });

    it('gets expiring soon keys', async () => {
      const expiringKeys = [
        {
          id: '1',
          name: 'Expiring Key',
          keyHint: 'abcd',
          service: 'n8n',
          expiresAt: new Date('2026-02-01'),
          isActive: true,
        },
      ];
      getExpiringSoon.mockResolvedValue(expiringKeys);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'getExpiringSoon',
            daysAhead: 30,
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.apiKeys).toHaveLength(1);
      expect(data.apiKeys[0].name).toBe('Expiring Key');
    });

    it('gets expiring soon with default days', async () => {
      getExpiringSoon.mockResolvedValue([]);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'getExpiringSoon',
          }),
        },
      });

      await action(args, apiKeyService);

      expect(getExpiringSoon).toHaveBeenCalledWith('user-1', 'server-1', 30);
    });

    it('gets keys by service', async () => {
      const keys = [
        {
          id: '1',
          name: 'n8n Key',
          keyHint: 'abcd',
          service: 'n8n',
          isActive: true,
          createdAt: new Date('2026-01-01'),
        },
      ];
      getByService.mockResolvedValue(keys);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'getByService',
            service: 'n8n',
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.apiKeys).toHaveLength(1);
      expect(data.apiKeys[0].service).toBe('n8n');
    });

    it('returns 400 when getByService is missing service', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'getByService',
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Service required');
    });

    it('creates an API key with expiration date', async () => {
      const apiKey = {
        id: '1',
        name: 'New Key',
        description: 'Test',
        keyHint: 'abcd',
        service: 'n8n',
        tags: ['test'],
        expiresAt: new Date('2026-12-31'),
        lastUsedAt: null,
        usageCount: 0,
        isActive: true,
        notes: 'Test notes',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      };
      createApiKey.mockResolvedValue(apiKey);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'create',
            name: 'New Key',
            keyHint: 'abcd',
            service: 'n8n',
            expiresAt: '2026-12-31',
            description: 'Test',
            tags: ['test'],
            notes: 'Test notes',
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.apiKey.expiresAt).toBe('2026-12-31T00:00:00.000Z');
    });

    it('updates an API key with expiresAt null', async () => {
      const apiKey = {
        id: '1',
        name: 'Updated Key',
        description: 'Test',
        keyHint: 'abcd',
        service: 'n8n',
        tags: [],
        expiresAt: null,
        lastUsedAt: null,
        usageCount: 0,
        isActive: true,
        notes: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      };
      updateApiKey.mockResolvedValue(apiKey);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'update',
            id: '1',
            name: 'Updated Key',
            expiresAt: null,
          }),
        },
      });

      const response = await action(args, apiKeyService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.apiKey.expiresAt).toBeNull();
    });
  });
});
