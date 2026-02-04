import type { EntityManager } from '@mikro-orm/core';
import { fromPartial } from '@total-typescript/shoehorn';
import { ApiKeyRegistryService } from '../../app/api-keys/ApiKeyRegistryService.server';
import { ApiKeyRegistry } from '../../app/entities/ApiKeyRegistry';
import type { Server } from '../../app/entities/Server';
import type { User } from '../../app/entities/User';

describe('ApiKeyRegistryService', () => {
  const find = vi.fn();
  const findOne = vi.fn();
  const findOneOrFail = vi.fn();
  const persist = vi.fn();
  const flush = vi.fn();
  const removeAndFlush = vi.fn();
  const em = fromPartial<EntityManager>({
    find,
    findOne,
    findOneOrFail,
    persist,
    flush,
    removeAndFlush,
  });
  let apiKeyService: ApiKeyRegistryService;

  beforeEach(() => {
    vi.clearAllMocks();
    apiKeyService = new ApiKeyRegistryService(em);
  });

  describe('getApiKeys', () => {
    it('returns API keys for user and server', async () => {
      const apiKeys = [
        fromPartial<ApiKeyRegistry>({ id: '1', name: 'Key 1' }),
        fromPartial<ApiKeyRegistry>({ id: '2', name: 'Key 2' }),
      ];
      find.mockResolvedValue(apiKeys);

      const result = await apiKeyService.getApiKeys('user-1', 'server-1');

      expect(result).toEqual(apiKeys);
      expect(find).toHaveBeenCalledWith(
        ApiKeyRegistry,
        { user: { publicId: 'user-1' }, server: { publicId: 'server-1' } },
        { orderBy: { createdAt: 'DESC' } },
      );
    });
  });

  describe('getApiKey', () => {
    it('returns API key by id', async () => {
      const apiKey = fromPartial<ApiKeyRegistry>({ id: '1', name: 'Key 1' });
      findOne.mockResolvedValue(apiKey);

      const result = await apiKeyService.getApiKey('1', 'user-1', 'server-1');

      expect(result).toEqual(apiKey);
      expect(findOne).toHaveBeenCalledWith(ApiKeyRegistry, {
        id: '1',
        user: { publicId: 'user-1' },
        server: { publicId: 'server-1' },
      });
    });

    it('returns null when not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await apiKeyService.getApiKey('1', 'user-1', 'server-1');

      expect(result).toBeNull();
    });
  });

  describe('createApiKey', () => {
    it('creates a new API key', async () => {
      const user = fromPartial<User>({ publicId: 'user-1' });
      const server = fromPartial<Server>({ publicId: 'server-1' });
      findOneOrFail
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(server);

      const result = await apiKeyService.createApiKey('user-1', 'server-1', {
        name: 'New Key',
        description: 'Test key',
        keyHint: 'abcd',
        service: 'dashboard',
        tags: ['test'],
        notes: 'Test notes',
      });

      expect(findOneOrFail).toHaveBeenCalledTimes(2);
      expect(persist).toHaveBeenCalledOnce();
      expect(flush).toHaveBeenCalledOnce();
      expect(result.name).toBe('New Key');
      expect(result.description).toBe('Test key');
      expect(result.keyHint).toBe('abcd');
      expect(result.service).toBe('dashboard');
      expect(result.tags).toEqual(['test']);
      expect(result.notes).toBe('Test notes');
      expect(result.isActive).toBe(true);
      expect(result.usageCount).toBe(0);
    });
  });

  describe('updateApiKey', () => {
    it('updates API key and returns it', async () => {
      const apiKey = fromPartial<ApiKeyRegistry>({
        id: '1',
        name: 'Old Name',
        isActive: true,
        updatedAt: new Date(),
      });
      findOne.mockResolvedValue(apiKey);

      const result = await apiKeyService.updateApiKey('1', 'user-1', 'server-1', {
        name: 'New Name',
        isActive: false,
      });

      expect(result).toBe(apiKey);
      expect(apiKey.name).toBe('New Name');
      expect(apiKey.isActive).toBe(false);
      expect(flush).toHaveBeenCalledOnce();
    });

    it('returns null when not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await apiKeyService.updateApiKey('1', 'user-1', 'server-1', { name: 'Test' });

      expect(result).toBeNull();
      expect(flush).not.toHaveBeenCalled();
    });
  });

  describe('deleteApiKey', () => {
    it('deletes API key and returns true', async () => {
      const apiKey = fromPartial<ApiKeyRegistry>({ id: '1' });
      findOne.mockResolvedValue(apiKey);

      const result = await apiKeyService.deleteApiKey('1', 'user-1', 'server-1');

      expect(result).toBe(true);
      expect(removeAndFlush).toHaveBeenCalledWith(apiKey);
    });

    it('returns false when not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await apiKeyService.deleteApiKey('1', 'user-1', 'server-1');

      expect(result).toBe(false);
      expect(removeAndFlush).not.toHaveBeenCalled();
    });
  });

  describe('recordUsage', () => {
    it('records usage and returns true', async () => {
      const apiKey = fromPartial<ApiKeyRegistry>({
        id: '1',
        usageCount: 5,
        lastUsedAt: null,
        updatedAt: new Date(),
      });
      findOne.mockResolvedValue(apiKey);

      const result = await apiKeyService.recordUsage('1', 'user-1', 'server-1');

      expect(result).toBe(true);
      expect(apiKey.usageCount).toBe(6);
      expect(apiKey.lastUsedAt).toBeInstanceOf(Date);
      expect(flush).toHaveBeenCalledOnce();
    });

    it('returns false when not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await apiKeyService.recordUsage('1', 'user-1', 'server-1');

      expect(result).toBe(false);
    });
  });

  describe('getExpiringSoon', () => {
    it('returns keys expiring within days', async () => {
      const expiringKeys = [
        fromPartial<ApiKeyRegistry>({ id: '1', expiresAt: new Date() }),
      ];
      find.mockResolvedValue(expiringKeys);

      const result = await apiKeyService.getExpiringSoon('user-1', 'server-1', 30);

      expect(result).toEqual(expiringKeys);
      expect(find).toHaveBeenCalledWith(
        ApiKeyRegistry,
        expect.objectContaining({
          user: { publicId: 'user-1' },
          server: { publicId: 'server-1' },
          isActive: true,
        }),
        { orderBy: { expiresAt: 'ASC' } },
      );
    });
  });

  describe('getByService', () => {
    it('returns keys by service', async () => {
      const keys = [fromPartial<ApiKeyRegistry>({ id: '1', service: 'n8n' })];
      find.mockResolvedValue(keys);

      const result = await apiKeyService.getByService('user-1', 'server-1', 'n8n');

      expect(result).toEqual(keys);
      expect(find).toHaveBeenCalledWith(
        ApiKeyRegistry,
        {
          user: { publicId: 'user-1' },
          server: { publicId: 'server-1' },
          service: 'n8n',
        },
        { orderBy: { createdAt: 'DESC' } },
      );
    });
  });
});
