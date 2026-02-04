import { fromPartial } from '@total-typescript/shoehorn';
import { ShlinkApiKeyService } from '../../app/api-keys/ShlinkApiKeyService.server';
import type { Server } from '../../app/entities/Server';

describe('ShlinkApiKeyService', () => {
  let shlinkApiKeyService: ShlinkApiKeyService;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    shlinkApiKeyService = new ShlinkApiKeyService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const server = fromPartial<Server>({
    baseUrl: 'https://shlink.example.com',
    apiKey: 'test-api-key',
  });

  describe('listApiKeys', () => {
    it('returns list of API keys', async () => {
      const apiKeys = [
        { key: 'key1', name: 'Key 1', expirationDate: null, roles: [] },
        { key: 'key2', name: 'Key 2', expirationDate: '2026-12-31', roles: [] },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ apiKeys: { data: apiKeys } }),
      });

      const result = await shlinkApiKeyService.listApiKeys(server);

      expect(result).toEqual(apiKeys);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://shlink.example.com/rest/v3/api-keys',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'X-Api-Key': 'test-api-key',
            'Accept': 'application/json',
          },
        }),
      );
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      });

      await expect(shlinkApiKeyService.listApiKeys(server)).rejects.toThrow('Failed to list API keys: 403');
    });
  });

  describe('createApiKey', () => {
    it('creates API key with default options', async () => {
      const newKey = { key: 'new-key', name: null, expirationDate: null, roles: [] };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(newKey),
      });

      const result = await shlinkApiKeyService.createApiKey(server);

      expect(result).toEqual(newKey);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://shlink.example.com/rest/v3/api-keys',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'X-Api-Key': 'test-api-key',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: '{}',
        }),
      );
    });

    it('creates API key with options', async () => {
      const newKey = {
        key: 'new-key',
        name: 'Test Key',
        expirationDate: '2026-12-31',
        roles: [{ role: 'AUTHORED_SHORT_URLS', meta: {} }],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(newKey),
      });

      const result = await shlinkApiKeyService.createApiKey(server, {
        name: 'Test Key',
        expirationDate: '2026-12-31',
        roles: [{ role: 'AUTHORED_SHORT_URLS' }],
      });

      expect(result).toEqual(newKey);
    });

    it('throws error on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      await expect(shlinkApiKeyService.createApiKey(server)).rejects.toThrow('Failed to create API key: 500');
    });
  });

  describe('deleteApiKey', () => {
    it('deletes API key and returns true', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const result = await shlinkApiKeyService.deleteApiKey(server, 'key-to-delete');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://shlink.example.com/rest/v3/api-keys/key-to-delete',
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            'X-Api-Key': 'test-api-key',
            'Accept': 'application/json',
          },
        }),
      );
    });

    it('returns false when not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await shlinkApiKeyService.deleteApiKey(server, 'nonexistent');

      expect(result).toBe(false);
    });

    it('throws error on other failures', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      await expect(shlinkApiKeyService.deleteApiKey(server, 'key')).rejects.toThrow('Failed to delete API key: 500');
    });
  });
});
