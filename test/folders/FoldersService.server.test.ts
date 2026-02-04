import type { EntityManager } from '@mikro-orm/core';
import { fromPartial } from '@total-typescript/shoehorn';
import { Folder, FolderItem } from '../../app/entities/Folder';
import type { Server } from '../../app/entities/Server';
import type { User } from '../../app/entities/User';
import { FoldersService } from '../../app/folders/FoldersService.server';

describe('FoldersService', () => {
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
  let foldersService: FoldersService;

  beforeEach(() => {
    vi.clearAllMocks();
    foldersService = new FoldersService(em);
  });

  describe('getFolders', () => {
    it('returns folders for user and server', async () => {
      const folders = [
        fromPartial<Folder>({ id: '1', name: 'Folder 1' }),
        fromPartial<Folder>({ id: '2', name: 'Folder 2' }),
      ];
      find.mockResolvedValue(folders);

      const result = await foldersService.getFolders('user-1', 'server-1');

      expect(result).toEqual(folders);
      expect(find).toHaveBeenCalledWith(
        Folder,
        { user: { publicId: 'user-1' }, server: { publicId: 'server-1' } },
        { populate: ['items'], orderBy: { name: 'ASC' } },
      );
    });
  });

  describe('getFolder', () => {
    it('returns folder by id', async () => {
      const folder = fromPartial<Folder>({ id: '1', name: 'Folder 1' });
      findOne.mockResolvedValue(folder);

      const result = await foldersService.getFolder('1', 'user-1', 'server-1');

      expect(result).toEqual(folder);
      expect(findOne).toHaveBeenCalledWith(
        Folder,
        { id: '1', user: { publicId: 'user-1' }, server: { publicId: 'server-1' } },
        { populate: ['items'] },
      );
    });
  });

  describe('createFolder', () => {
    it('creates a new folder', async () => {
      const user = fromPartial<User>({ publicId: 'user-1' });
      const server = fromPartial<Server>({ publicId: 'server-1' });
      findOneOrFail
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(server);
      findOne.mockResolvedValue(null); // No existing folder

      const result = await foldersService.createFolder('user-1', 'server-1', {
        name: 'New Folder',
        color: '#ff0000',
      });

      expect(findOneOrFail).toHaveBeenCalledTimes(2);
      expect(persist).toHaveBeenCalledOnce();
      expect(flush).toHaveBeenCalledOnce();
      expect(result.name).toBe('New Folder');
      expect(result.color).toBe('#ff0000');
      expect(result.user).toBe(user);
      expect(result.server).toBe(server);
    });

    it('throws error if folder name already exists', async () => {
      const user = fromPartial<User>({ publicId: 'user-1' });
      const server = fromPartial<Server>({ publicId: 'server-1' });
      findOneOrFail
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(server);
      findOne.mockResolvedValue(fromPartial<Folder>({ id: '1' })); // Existing folder

      await expect(
        foldersService.createFolder('user-1', 'server-1', { name: 'Existing' }),
      ).rejects.toThrow('A folder with this name already exists');
    });
  });

  describe('updateFolder', () => {
    it('updates folder and returns it', async () => {
      const folder = fromPartial<Folder>({ id: '1', name: 'Old Name', color: '#000' });
      findOne.mockResolvedValue(folder);

      const result = await foldersService.updateFolder('1', 'user-1', 'server-1', {
        name: 'New Name',
        color: '#fff',
      });

      expect(result).toBe(folder);
      expect(folder.name).toBe('New Name');
      expect(folder.color).toBe('#fff');
      expect(flush).toHaveBeenCalledOnce();
    });

    it('updates only name when color is not provided', async () => {
      const folder = fromPartial<Folder>({ id: '1', name: 'Old Name', color: '#000' });
      findOne.mockResolvedValue(folder);

      const result = await foldersService.updateFolder('1', 'user-1', 'server-1', {
        name: 'New Name',
      });

      expect(result).toBe(folder);
      expect(folder.name).toBe('New Name');
      expect(folder.color).toBe('#000'); // Color unchanged
    });

    it('updates only color when name is not provided', async () => {
      const folder = fromPartial<Folder>({ id: '1', name: 'Old Name', color: '#000' });
      findOne.mockResolvedValue(folder);

      const result = await foldersService.updateFolder('1', 'user-1', 'server-1', {
        color: '#fff',
      });

      expect(result).toBe(folder);
      expect(folder.name).toBe('Old Name'); // Name unchanged
      expect(folder.color).toBe('#fff');
    });

    it('sets color to null when empty string provided', async () => {
      const folder = fromPartial<Folder>({ id: '1', name: 'Old Name', color: '#000' });
      findOne.mockResolvedValue(folder);

      const result = await foldersService.updateFolder('1', 'user-1', 'server-1', {
        color: '',
      });

      expect(result).toBe(folder);
      expect(folder.color).toBeNull();
    });

    it('returns null when folder not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await foldersService.updateFolder('1', 'user-1', 'server-1', { name: 'Test' });

      expect(result).toBeNull();
      expect(flush).not.toHaveBeenCalled();
    });
  });

  describe('deleteFolder', () => {
    it('deletes folder and returns true', async () => {
      const folder = fromPartial<Folder>({ id: '1' });
      findOne.mockResolvedValue(folder);

      const result = await foldersService.deleteFolder('1', 'user-1', 'server-1');

      expect(result).toBe(true);
      expect(removeAndFlush).toHaveBeenCalledWith(folder);
    });

    it('returns false when folder not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await foldersService.deleteFolder('1', 'user-1', 'server-1');

      expect(result).toBe(false);
      expect(removeAndFlush).not.toHaveBeenCalled();
    });
  });

  describe('addToFolder', () => {
    it('adds item to folder', async () => {
      const folder = fromPartial<Folder>({ id: '1' });
      findOne
        .mockResolvedValueOnce(folder) // getFolder
        .mockResolvedValueOnce(null); // no existing item

      const result = await foldersService.addToFolder('1', 'user-1', 'server-1', {
        shortUrlId: 'url-1',
        shortCode: 'abc',
      });

      expect(result).not.toBeNull();
      expect(persist).toHaveBeenCalledOnce();
      expect(flush).toHaveBeenCalledOnce();
      expect(result?.shortUrlId).toBe('url-1');
      expect(result?.shortCode).toBe('abc');
      expect(result?.folder).toBe(folder);
    });

    it('returns existing item if already in folder', async () => {
      const folder = fromPartial<Folder>({ id: '1' });
      const existingItem = fromPartial<FolderItem>({ id: '1', shortUrlId: 'url-1' });
      findOne
        .mockResolvedValueOnce(folder)
        .mockResolvedValueOnce(existingItem);

      const result = await foldersService.addToFolder('1', 'user-1', 'server-1', {
        shortUrlId: 'url-1',
        shortCode: 'abc',
      });

      expect(result).toBe(existingItem);
      expect(persist).not.toHaveBeenCalled();
    });

    it('returns null when folder not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await foldersService.addToFolder('1', 'user-1', 'server-1', {
        shortUrlId: 'url-1',
        shortCode: 'abc',
      });

      expect(result).toBeNull();
      expect(persist).not.toHaveBeenCalled();
    });
  });

  describe('removeFromFolder', () => {
    it('removes item and returns true', async () => {
      const folder = fromPartial<Folder>({ id: '1' });
      const item = fromPartial<FolderItem>({ id: '1' });
      findOne
        .mockResolvedValueOnce(folder)
        .mockResolvedValueOnce(item);

      const result = await foldersService.removeFromFolder('1', 'user-1', 'server-1', 'url-1');

      expect(result).toBe(true);
      expect(removeAndFlush).toHaveBeenCalledWith(item);
    });

    it('returns false when folder not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await foldersService.removeFromFolder('1', 'user-1', 'server-1', 'url-1');

      expect(result).toBe(false);
    });

    it('returns false when item not found', async () => {
      const folder = fromPartial<Folder>({ id: '1' });
      findOne
        .mockResolvedValueOnce(folder)
        .mockResolvedValueOnce(null);

      const result = await foldersService.removeFromFolder('1', 'user-1', 'server-1', 'url-1');

      expect(result).toBe(false);
    });
  });

  describe('getFoldersForShortUrl', () => {
    it('returns folders containing the short URL', async () => {
      const folder1 = fromPartial<Folder>({ id: '1', name: 'Folder 1' });
      const folder2 = fromPartial<Folder>({ id: '2', name: 'Folder 2' });
      const items = [
        fromPartial<FolderItem>({ folder: folder1 }),
        fromPartial<FolderItem>({ folder: folder2 }),
      ];
      find.mockResolvedValue(items);

      const result = await foldersService.getFoldersForShortUrl('user-1', 'server-1', 'url-1');

      expect(result).toEqual([folder1, folder2]);
      expect(find).toHaveBeenCalledWith(
        FolderItem,
        {
          shortUrlId: 'url-1',
          folder: {
            user: { publicId: 'user-1' },
            server: { publicId: 'server-1' },
          },
        },
        { populate: ['folder'] },
      );
    });
  });
});
