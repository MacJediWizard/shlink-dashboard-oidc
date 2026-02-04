import { fromPartial } from '@total-typescript/shoehorn';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import type { FavoritesService } from '../../app/favorites/FavoritesService.server';
import { action, loader } from '../../app/routes/server.$serverId.favorites';

describe('server.$serverId.favorites', () => {
  const mockSession = { publicId: 'user-1', username: 'testuser', role: 'admin' as const };
  const mockContext = {
    get: vi.fn().mockReturnValue(mockSession),
  };

  const getFavorites = vi.fn();
  const addFavorite = vi.fn();
  const removeFavorite = vi.fn();
  const isFavorite = vi.fn();
  const updateFavoriteNotes = vi.fn();
  const favoritesService = fromPartial<FavoritesService>({
    getFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    updateFavoriteNotes,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.get.mockReturnValue(mockSession);
  });

  describe('loader', () => {
    it('returns 400 when serverId is missing', async () => {
      const args = fromPartial<LoaderFunctionArgs>({
        params: {},
        context: mockContext,
      });

      const response = await loader(args, favoritesService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Server ID required');
    });

    it('returns favorites for user and server', async () => {
      const favorites = [
        {
          shortUrlId: '1',
          shortCode: 'abc',
          longUrl: 'https://example.com',
          title: 'Example',
          notes: 'Test',
          createdAt: new Date('2026-01-01'),
        },
      ];
      getFavorites.mockResolvedValue(favorites);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const response = await loader(args, favoritesService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.favorites).toHaveLength(1);
      expect(data.favorites[0].shortCode).toBe('abc');
      expect(getFavorites).toHaveBeenCalledWith('user-1', 'server-1');
    });
  });

  describe('action', () => {
    it('returns 400 when serverId is missing', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: {},
        context: mockContext,
        request: { json: vi.fn().mockResolvedValue({}) },
      });

      const response = await action(args, favoritesService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Server ID required');
    });

    it('adds a favorite', async () => {
      const favorite = {
        shortUrlId: '1',
        shortCode: 'abc',
        longUrl: 'https://example.com',
        title: 'Example',
        notes: null,
        createdAt: new Date('2026-01-01'),
      };
      addFavorite.mockResolvedValue(favorite);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'add',
            shortUrlId: '1',
            shortCode: 'abc',
            longUrl: 'https://example.com',
          }),
        },
      });

      const response = await action(args, favoritesService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(addFavorite).toHaveBeenCalled();
    });

    it('removes a favorite', async () => {
      removeFavorite.mockResolvedValue(true);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'remove',
            shortUrlId: '1',
          }),
        },
      });

      const response = await action(args, favoritesService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('checks if favorite exists', async () => {
      isFavorite.mockResolvedValue(true);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'check',
            shortUrlId: '1',
          }),
        },
      });

      const response = await action(args, favoritesService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isFavorite).toBe(true);
    });

    it('returns 400 for invalid action', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({ action: 'invalid' }),
        },
      });

      const response = await action(args, favoritesService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });
  });
});
