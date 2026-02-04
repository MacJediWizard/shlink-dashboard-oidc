import type { EntityManager } from '@mikro-orm/core';
import { fromPartial } from '@total-typescript/shoehorn';
import { Favorite } from '../../app/entities/Favorite';
import type { Server } from '../../app/entities/Server';
import type { User } from '../../app/entities/User';
import { FavoritesService } from '../../app/favorites/FavoritesService.server';

describe('FavoritesService', () => {
  const find = vi.fn();
  const findOne = vi.fn();
  const findOneOrFail = vi.fn();
  const persist = vi.fn();
  const flush = vi.fn();
  const removeAndFlush = vi.fn();
  const count = vi.fn();
  const em = fromPartial<EntityManager>({
    find,
    findOne,
    findOneOrFail,
    persist,
    flush,
    removeAndFlush,
    count,
  });
  let favoritesService: FavoritesService;

  beforeEach(() => {
    vi.clearAllMocks();
    favoritesService = new FavoritesService(em);
  });

  describe('getFavorites', () => {
    it('returns favorites for user and server', async () => {
      const favorites = [
        fromPartial<Favorite>({ shortUrlId: '1', shortCode: 'abc' }),
        fromPartial<Favorite>({ shortUrlId: '2', shortCode: 'def' }),
      ];
      find.mockResolvedValue(favorites);

      const result = await favoritesService.getFavorites('user-1', 'server-1');

      expect(result).toEqual(favorites);
      expect(find).toHaveBeenCalledWith(
        Favorite,
        { user: { publicId: 'user-1' }, server: { publicId: 'server-1' } },
        { orderBy: { createdAt: 'DESC' } },
      );
    });
  });

  describe('addFavorite', () => {
    it('creates a new favorite', async () => {
      const user = fromPartial<User>({ publicId: 'user-1' });
      const server = fromPartial<Server>({ publicId: 'server-1' });
      findOneOrFail
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(server);

      const result = await favoritesService.addFavorite('user-1', 'server-1', {
        shortUrlId: 'url-1',
        shortCode: 'abc',
        longUrl: 'https://example.com',
        title: 'Example',
        notes: 'Test note',
      });

      expect(findOneOrFail).toHaveBeenCalledTimes(2);
      expect(persist).toHaveBeenCalledOnce();
      expect(flush).toHaveBeenCalledOnce();
      expect(result.shortUrlId).toBe('url-1');
      expect(result.shortCode).toBe('abc');
      expect(result.longUrl).toBe('https://example.com');
      expect(result.title).toBe('Example');
      expect(result.notes).toBe('Test note');
      expect(result.user).toBe(user);
      expect(result.server).toBe(server);
    });
  });

  describe('removeFavorite', () => {
    it('removes existing favorite and returns true', async () => {
      const favorite = fromPartial<Favorite>({ shortUrlId: 'url-1' });
      findOne.mockResolvedValue(favorite);

      const result = await favoritesService.removeFavorite('user-1', 'server-1', 'url-1');

      expect(result).toBe(true);
      expect(removeAndFlush).toHaveBeenCalledWith(favorite);
    });

    it('returns false when favorite not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await favoritesService.removeFavorite('user-1', 'server-1', 'url-1');

      expect(result).toBe(false);
      expect(removeAndFlush).not.toHaveBeenCalled();
    });
  });

  describe('isFavorite', () => {
    it('returns true when favorite exists', async () => {
      count.mockResolvedValue(1);

      const result = await favoritesService.isFavorite('user-1', 'server-1', 'url-1');

      expect(result).toBe(true);
    });

    it('returns false when favorite does not exist', async () => {
      count.mockResolvedValue(0);

      const result = await favoritesService.isFavorite('user-1', 'server-1', 'url-1');

      expect(result).toBe(false);
    });
  });

  describe('updateFavoriteNotes', () => {
    it('updates notes and returns favorite', async () => {
      const favorite = fromPartial<Favorite>({ notes: 'old' });
      findOne.mockResolvedValue(favorite);

      const result = await favoritesService.updateFavoriteNotes('user-1', 'server-1', 'url-1', 'new notes');

      expect(result).toBe(favorite);
      expect(favorite.notes).toBe('new notes');
      expect(flush).toHaveBeenCalledOnce();
    });

    it('returns null when favorite not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await favoritesService.updateFavoriteNotes('user-1', 'server-1', 'url-1', 'notes');

      expect(result).toBeNull();
      expect(flush).not.toHaveBeenCalled();
    });
  });
});
