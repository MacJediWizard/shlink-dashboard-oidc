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
  });
});
