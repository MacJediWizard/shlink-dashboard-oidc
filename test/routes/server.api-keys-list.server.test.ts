import { fromPartial } from '@total-typescript/shoehorn';
import type { LoaderFunctionArgs } from 'react-router';
import type { ApiKeyRegistryService } from '../../app/api-keys/ApiKeyRegistryService.server';
import type { ShlinkApiKeyService } from '../../app/api-keys/ShlinkApiKeyService.server';
import { loader } from '../../app/routes/server.$serverId.api-keys-list';
import type { ServersService } from '../../app/servers/ServersService.server';

describe('server.$serverId.api-keys-list', () => {
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

  const getApiKeys = vi.fn();
  const getExpiringSoon = vi.fn();
  const apiKeyService = fromPartial<ApiKeyRegistryService>({
    getApiKeys,
    getExpiringSoon,
  });

  const listApiKeys = vi.fn();
  const shlinkApiKeyService = fromPartial<ShlinkApiKeyService>({
    listApiKeys,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getByPublicIdAndUser.mockResolvedValue(mockServer);
    getExpiringSoon.mockResolvedValue([]);
    listApiKeys.mockResolvedValue([]);
  });

  describe('loader', () => {
    it('throws 400 when serverId is missing', async () => {
      const args = fromPartial<LoaderFunctionArgs>({
        params: {},
        context: mockContext,
      });

      try {
        await loader(args, serversService, apiKeyService, shlinkApiKeyService);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
      }
    });

    it('returns API keys for user and server', async () => {
      const apiKeys = [
        {
          id: 1,
          name: 'Key 1',
          description: 'Test key',
          keyHint: 'abcd',
          service: 'n8n',
          tags: ['test'],
          expiresAt: new Date('2026-12-31'),
          lastUsedAt: new Date('2026-01-15'),
          usageCount: 5,
          isActive: true,
          notes: 'My notes',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ];
      getApiKeys.mockResolvedValue(apiKeys);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const result = await loader(args, serversService, apiKeyService, shlinkApiKeyService);

      expect(result.serverId).toBe('server-1');
      expect(result.serverName).toBe('Test Server');
      expect(result.apiKeys).toHaveLength(1);
      expect(result.apiKeys[0].name).toBe('Key 1');
      expect(result.apiKeys[0].keyHint).toBe('abcd');
      expect(result.apiKeys[0].service).toBe('n8n');
    });

    it('returns empty array when no API keys', async () => {
      getApiKeys.mockResolvedValue([]);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const result = await loader(args, serversService, apiKeyService, shlinkApiKeyService);

      expect(result.apiKeys).toHaveLength(0);
    });

    it('handles null values correctly', async () => {
      const apiKeys = [
        {
          id: 1,
          name: 'Key 1',
          description: null,
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

      const result = await loader(args, serversService, apiKeyService, shlinkApiKeyService);

      expect(result.apiKeys[0].expiresAt).toBeNull();
      expect(result.apiKeys[0].lastUsedAt).toBeNull();
      expect(result.apiKeys[0].notes).toBeNull();
    });

    it('returns expiring key IDs', async () => {
      const expiringKeys = [{ id: 1 }, { id: 2 }];
      getApiKeys.mockResolvedValue([]);
      getExpiringSoon.mockResolvedValue(expiringKeys);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const result = await loader(args, serversService, apiKeyService, shlinkApiKeyService);

      expect(result.expiringKeyIds).toEqual([1, 2]);
    });

    it('returns Shlink API keys', async () => {
      const shlinkKeys = [
        { key: 'abc123', name: 'Test Key', expirationDate: null, roles: [] },
      ];
      getApiKeys.mockResolvedValue([]);
      listApiKeys.mockResolvedValue(shlinkKeys);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const result = await loader(args, serversService, apiKeyService, shlinkApiKeyService);

      expect(result.shlinkApiKeys).toHaveLength(1);
      expect(result.shlinkApiKeys[0].key).toBe('abc123');
      expect(result.shlinkApiError).toBeNull();
    });

    it('handles Shlink API error gracefully', async () => {
      getApiKeys.mockResolvedValue([]);
      listApiKeys.mockRejectedValue(new Error('Connection failed'));

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const result = await loader(args, serversService, apiKeyService, shlinkApiKeyService);

      expect(result.shlinkApiKeys).toHaveLength(0);
      expect(result.shlinkApiError).toBe('Connection failed');
    });
  });
});
