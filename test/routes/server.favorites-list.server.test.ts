import { fromPartial } from '@total-typescript/shoehorn';
import type { LoaderFunctionArgs } from 'react-router';
import type { FavoritesService } from '../../app/favorites/FavoritesService.server';
import { loader } from '../../app/routes/server.$serverId.favorites-list';
import type { ServersService } from '../../app/servers/ServersService.server';

describe('server.$serverId.favorites-list', () => {
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

  const getFavorites = vi.fn();
  const favoritesService = fromPartial<FavoritesService>({
    getFavorites,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getByPublicIdAndUser.mockResolvedValue(mockServer);
  });

  describe('loader', () => {
    it('throws 400 when serverId is missing', async () => {
      const args = fromPartial<LoaderFunctionArgs>({
        params: {},
        context: mockContext,
      });

      try {
        await loader(args, serversService, favoritesService);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
      }
    });

    it('returns favorites for user and server', async () => {
      const favorites = [
        {
          shortUrlId: 'url-1',
          shortCode: 'abc',
          longUrl: 'https://example.com/page1',
          title: 'Test Page',
          notes: 'My notes',
          createdAt: new Date('2026-01-01'),
        },
      ];
      getFavorites.mockResolvedValue(favorites);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const result = await loader(args, serversService, favoritesService);

      expect(result.serverId).toBe('server-1');
      expect(result.serverName).toBe('Test Server');
      expect(result.serverBaseUrl).toBe('https://shlink.example.com');
      expect(result.favorites).toHaveLength(1);
      expect(result.favorites[0].shortCode).toBe('abc');
      expect(result.favorites[0].notes).toBe('My notes');
    });

    it('returns empty array when no favorites', async () => {
      getFavorites.mockResolvedValue([]);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const result = await loader(args, serversService, favoritesService);

      expect(result.favorites).toHaveLength(0);
    });
  });
});
