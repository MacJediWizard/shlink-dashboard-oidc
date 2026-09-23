import { fromPartial } from '@total-typescript/shoehorn';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { action, loader } from '../../app/routes/server.$serverId.pixels';
import type { ServersService } from '../../app/servers/ServersService.server';

describe('server.$serverId.pixels', () => {
  const context = { get: vi.fn().mockReturnValue({ publicId: 'user-1' }) };
  const server = { publicId: 'server-1', name: 'Test Server', baseUrl: 'https://s.test', apiKey: 'key' };
  const getByPublicIdAndUser = vi.fn();
  const serversService = fromPartial<ServersService>({ getByPublicIdAndUser });

  const listShortUrls = vi.fn();
  const listDomains = vi.fn();
  const createShortUrl = vi.fn();
  const updateShortUrl = vi.fn();
  const deleteShortUrl = vi.fn();
  const getShortUrlVisits = vi.fn();
  const apiClientBuilder = vi.fn().mockReturnValue({
    listShortUrls,
    listDomains,
    createShortUrl,
    updateShortUrl,
    deleteShortUrl,
    getShortUrlVisits,
  });

  const jsonRequest = (body: unknown) =>
    new Request('https://dash.test/server/server-1/pixels', { method: 'POST', body: JSON.stringify(body) });
  const runAction = (body: unknown, params: Record<string, string> = { serverId: 'server-1' }) =>
    action(
      fromPartial<ActionFunctionArgs>({ request: jsonRequest(body), params, context }),
      serversService,
      apiClientBuilder,
    );

  beforeEach(() => {
    getByPublicIdAndUser.mockResolvedValue(server);
  });

  describe('loader', () => {
    const runLoader = (params: Record<string, string> = { serverId: 'server-1' }) =>
      loader(fromPartial<LoaderFunctionArgs>({ params, context }), serversService, apiClientBuilder);

    it('throws 400 when serverId is missing', async () => {
      await expect(runLoader({})).rejects.toSatisfy((e: Response) => e.status === 400);
    });

    it('checks the user has access to the server', async () => {
      getByPublicIdAndUser.mockRejectedValue(new Error('Server not found'));
      await expect(runLoader()).rejects.toThrow('Server not found');
      expect(getByPublicIdAndUser).toHaveBeenCalledWith('server-1', 'user-1');
      expect(listShortUrls).not.toHaveBeenCalled();
    });

    it('returns pixels and domains', async () => {
      listShortUrls.mockResolvedValue({
        data: [
          {
            shortCode: 'abc',
            domain: null,
            shortUrl: 'https://s.test/abc',
            longUrl: 'https://example.com',
            title: 'Sig',
            dateCreated: '2026-09-01T10:00:00+00:00',
            visitsSummary: { total: 2, nonBots: 1, bots: 1 },
          },
        ],
      });
      getShortUrlVisits.mockResolvedValue({ data: [], pagination: { totalItems: 0 } });
      listDomains.mockResolvedValue({ data: [{ domain: 's.test', isDefault: true }] });

      const result = await runLoader();

      expect(apiClientBuilder).toHaveBeenCalledWith(server);
      expect(result.serverName).toEqual('Test Server');
      expect(result.pixels).toHaveLength(1);
      expect(result.pixels[0].pixelUrl).toEqual('https://s.test/abc/track');
      expect(result.domains).toEqual([{ domain: 's.test', isDefault: true }]);
      expect(result.error).toBeUndefined();
    });

    it('returns Shlink error details', async () => {
      listShortUrls.mockRejectedValue({ detail: 'Invalid API key', status: 401 });
      listDomains.mockResolvedValue({ data: [] });

      const result = await runLoader();

      expect(result).toEqual({
        serverId: 'server-1',
        serverName: 'Test Server',
        pixels: [],
        domains: [],
        error: 'Invalid API key',
      });
    });
  });

  describe('action', () => {
    it('creates pixels', async () => {
      createShortUrl.mockResolvedValue({ shortCode: 'sig', title: 'Sig', domain: null });

      const result = await runAction({
        action: 'create',
        name: 'Sig',
        fallbackUrl: 'https://example.com',
        customSlug: 'sig',
      });

      expect(result).toEqual({ success: true, message: 'Pixel "Sig" created' });
      expect(createShortUrl).toHaveBeenCalledWith(expect.objectContaining({ customSlug: 'sig', tags: ['pixel'] }));
    });

    it('returns validation errors', async () => {
      const result = await runAction({ action: 'create', name: 'Sig', fallbackUrl: 'nope' });
      expect(result).toEqual({ success: false, error: 'Fallback URL must be a valid http(s) URL' });
      expect(createShortUrl).not.toHaveBeenCalled();
    });

    it('returns Shlink API errors', async () => {
      createShortUrl.mockRejectedValue({ detail: 'Provided slug "sig" is already in use.' });
      const result = await runAction({
        action: 'create',
        name: 'Sig',
        fallbackUrl: 'https://e.com',
        customSlug: 'sig',
      });
      expect(result).toEqual({ success: false, error: 'Provided slug "sig" is already in use.' });
    });

    it('renames pixels', async () => {
      const result = await runAction({ action: 'rename', shortCode: 'abc', domain: 'go.test', name: 'New' });
      expect(result).toEqual({ success: true, message: 'Pixel renamed' });
      expect(updateShortUrl).toHaveBeenCalledWith({ shortCode: 'abc', domain: 'go.test' }, { title: 'New' });
    });

    it('deletes pixels', async () => {
      const result = await runAction({ action: 'delete', shortCode: 'abc', domain: null });
      expect(result).toEqual({ success: true, message: 'Pixel deleted' });
      expect(deleteShortUrl).toHaveBeenCalledWith({ shortCode: 'abc', domain: null });
    });

    it('rejects unknown actions', async () => {
      expect(await runAction({ action: 'nope' })).toEqual({ success: false, error: 'Invalid action' });
    });

    it('checks the user has access to the server before acting', async () => {
      getByPublicIdAndUser.mockRejectedValue(new Error('Server not found'));
      await expect(runAction({ action: 'delete', shortCode: 'abc' })).rejects.toThrow('Server not found');
      expect(deleteShortUrl).not.toHaveBeenCalled();
    });
  });
});
