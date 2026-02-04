import { fromPartial } from '@total-typescript/shoehorn';
import type { LoaderFunctionArgs } from 'react-router';
import type { FoldersService } from '../../app/folders/FoldersService.server';
import { loader } from '../../app/routes/server.$serverId.folders-list';
import type { ServersService } from '../../app/servers/ServersService.server';

describe('server.$serverId.folders-list', () => {
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

  const getFolders = vi.fn();
  const foldersService = fromPartial<FoldersService>({
    getFolders,
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
        await loader(args, serversService, foldersService);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
      }
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

      const result = await loader(args, serversService, foldersService);

      expect(result.serverId).toBe('server-1');
      expect(result.serverName).toBe('Test Server');
      expect(result.folders).toHaveLength(1);
      expect(result.folders[0].name).toBe('Folder 1');
      expect(result.folders[0].itemCount).toBe(2);
      expect(result.folders[0].items).toHaveLength(2);
    });

    it('returns empty array when no folders', async () => {
      getFolders.mockResolvedValue([]);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const result = await loader(args, serversService, foldersService);

      expect(result.folders).toHaveLength(0);
    });
  });
});
