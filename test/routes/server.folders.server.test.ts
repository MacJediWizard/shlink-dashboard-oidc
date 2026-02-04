import { fromPartial } from '@total-typescript/shoehorn';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import type { FoldersService } from '../../app/folders/FoldersService.server';
import { action, loader } from '../../app/routes/server.$serverId.folders';

describe('server.$serverId.folders', () => {
  const mockSession = { publicId: 'user-1', username: 'testuser', role: 'admin' as const };
  const mockContext = {
    get: vi.fn().mockReturnValue(mockSession),
  };

  const getFolders = vi.fn();
  const createFolder = vi.fn();
  const updateFolder = vi.fn();
  const deleteFolder = vi.fn();
  const addToFolder = vi.fn();
  const removeFromFolder = vi.fn();
  const getFoldersForShortUrl = vi.fn();
  const foldersService = fromPartial<FoldersService>({
    getFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    addToFolder,
    removeFromFolder,
    getFoldersForShortUrl,
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

      const response = await loader(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Server ID required');
    });

    it('returns folders for user and server', async () => {
      const folders = [
        {
          id: 1,
          name: 'Folder 1',
          color: '#ff0000',
          createdAt: new Date('2026-01-01'),
          items: {
            length: 2,
            getItems: () => [
              { shortUrlId: 'url-1', shortCode: 'abc', addedAt: new Date('2026-01-01') },
              { shortUrlId: 'url-2', shortCode: 'def', addedAt: new Date('2026-01-02') },
            ],
          },
        },
      ];
      getFolders.mockResolvedValue(folders);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const response = await loader(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.folders).toHaveLength(1);
      expect(data.folders[0].name).toBe('Folder 1');
      expect(data.folders[0].itemCount).toBe(2);
      expect(data.folders[0].items).toHaveLength(2);
    });
  });

  describe('action', () => {
    it('returns 400 when serverId is missing', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: {},
        context: mockContext,
        request: { json: vi.fn().mockResolvedValue({}) },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Server ID required');
    });

    it('creates a folder', async () => {
      const folder = {
        id: 1,
        name: 'New Folder',
        color: '#ff0000',
        createdAt: new Date('2026-01-01'),
      };
      createFolder.mockResolvedValue(folder);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'create',
            name: 'New Folder',
            color: '#ff0000',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.folder.name).toBe('New Folder');
    });

    it('deletes a folder', async () => {
      deleteFolder.mockResolvedValue(true);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'delete',
            folderId: 1,
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('adds item to folder', async () => {
      const item = {
        id: 1,
        shortUrlId: 'url-1',
        shortCode: 'abc',
        addedAt: new Date('2026-01-01'),
      };
      addToFolder.mockResolvedValue(item);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'addItem',
            folderId: 1,
            shortUrlId: 'url-1',
            shortCode: 'abc',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('removes item from folder', async () => {
      removeFromFolder.mockResolvedValue(true);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'removeItem',
            folderId: 1,
            shortUrlId: 'url-1',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('gets folders for URL', async () => {
      const folders = [
        { id: 1, name: 'Folder 1', color: '#ff0000' },
      ];
      getFoldersForShortUrl.mockResolvedValue(folders);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'getFoldersForUrl',
            shortUrlId: 'url-1',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.folders).toHaveLength(1);
    });

    it('returns 400 for invalid action', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({ action: 'invalid' }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });

    it('returns 400 when create is missing name', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'create',
            color: '#ff0000',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Folder name required');
    });

    it('returns 400 when create fails with error', async () => {
      createFolder.mockRejectedValue(new Error('A folder with this name already exists'));

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'create',
            name: 'Existing Folder',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('A folder with this name already exists');
    });

    it('updates a folder', async () => {
      const folder = {
        id: '1',
        name: 'Updated Folder',
        color: '#00ff00',
      };
      updateFolder.mockResolvedValue(folder);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'update',
            folderId: '1',
            name: 'Updated Folder',
            color: '#00ff00',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 400 when update is missing folderId', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'update',
            name: 'Updated Folder',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Folder ID required');
    });

    it('returns 404 when update folder not found', async () => {
      updateFolder.mockResolvedValue(null);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'update',
            folderId: 'nonexistent',
            name: 'Updated Folder',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Folder not found');
    });

    it('returns 400 when delete is missing folderId', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'delete',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Folder ID required');
    });

    it('returns 404 when delete folder not found', async () => {
      deleteFolder.mockResolvedValue(false);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'delete',
            folderId: 'nonexistent',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Folder not found');
    });

    it('returns 400 when addItem is missing required fields', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'addItem',
            folderId: '1',
            // Missing shortUrlId and shortCode
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields');
    });

    it('returns 404 when addItem folder not found', async () => {
      addToFolder.mockResolvedValue(null);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'addItem',
            folderId: 'nonexistent',
            shortUrlId: 'url-1',
            shortCode: 'abc',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Folder not found');
    });

    it('returns 400 when removeItem is missing required fields', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'removeItem',
            folderId: '1',
            // Missing shortUrlId
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields');
    });

    it('returns 404 when removeItem not found', async () => {
      removeFromFolder.mockResolvedValue(false);

      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'removeItem',
            folderId: '1',
            shortUrlId: 'nonexistent',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Item not found');
    });

    it('returns 400 when getFoldersForUrl is missing shortUrlId', async () => {
      const args = fromPartial<ActionFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
        request: {
          json: vi.fn().mockResolvedValue({
            action: 'getFoldersForUrl',
          }),
        },
      });

      const response = await action(args, foldersService);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Short URL ID required');
    });
  });
});
