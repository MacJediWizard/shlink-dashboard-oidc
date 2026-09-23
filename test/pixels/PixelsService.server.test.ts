import type { ShlinkApiClient } from '@shlinkio/shlink-js-sdk/api-contract';
import { fromPartial } from '@total-typescript/shoehorn';
import { PixelsService, PixelValidationError } from '../../app/pixels/PixelsService.server';

describe('PixelsService', () => {
  const listShortUrls = vi.fn();
  const listDomains = vi.fn();
  const createShortUrl = vi.fn();
  const updateShortUrl = vi.fn();
  const deleteShortUrl = vi.fn();
  const getShortUrlVisits = vi.fn();
  const apiClient = fromPartial<ShlinkApiClient>({
    listShortUrls,
    listDomains,
    createShortUrl,
    updateShortUrl,
    deleteShortUrl,
    getShortUrlVisits,
  });
  let service: PixelsService;

  const shortUrl = (overrides: Record<string, unknown> = {}) => ({
    shortCode: 'abc123',
    domain: null,
    shortUrl: 'https://s.test/abc123',
    longUrl: 'https://example.com',
    title: 'Signature',
    dateCreated: '2026-09-01T10:00:00+00:00',
    visitsSummary: { total: 12, nonBots: 9, bots: 3 },
    tags: ['pixel'],
    ...overrides,
  });

  beforeEach(() => {
    service = new PixelsService(apiClient);
  });

  describe('listPixels', () => {
    it('lists short URLs tagged as pixel with their stats', async () => {
      listShortUrls.mockResolvedValue({ data: [shortUrl()] });
      getShortUrlVisits
        .mockResolvedValueOnce({ data: [{ date: '2026-09-20T08:00:00+00:00' }], pagination: { totalItems: 9 } })
        .mockResolvedValueOnce({ data: [{ date: '2026-09-20T08:00:00+00:00' }], pagination: { totalItems: 4 } });

      const pixels = await service.listPixels(new Date('2026-09-22T00:00:00Z'));

      expect(listShortUrls).toHaveBeenCalledWith(expect.objectContaining({ tags: ['pixel'] }));
      expect(getShortUrlVisits).toHaveBeenCalledWith(
        { shortCode: 'abc123', domain: null },
        { itemsPerPage: 1, excludeBots: true },
      );
      expect(getShortUrlVisits).toHaveBeenCalledWith(
        { shortCode: 'abc123', domain: null },
        { itemsPerPage: 1, excludeBots: true, startDate: '2026-09-15T00:00:00.000Z' },
      );
      expect(pixels).toEqual([
        {
          shortCode: 'abc123',
          domain: null,
          shortUrl: 'https://s.test/abc123',
          pixelUrl: 'https://s.test/abc123/track',
          name: 'Signature',
          fallbackUrl: 'https://example.com',
          dateCreated: '2026-09-01T10:00:00+00:00',
          opens: 9,
          botHits: 3,
          opensLast7Days: 4,
          lastOpened: '2026-09-20T08:00:00+00:00',
        },
      ]);
    });

    it('falls back to short code as name and handles pixels never opened', async () => {
      listShortUrls.mockResolvedValue({
        data: [shortUrl({ title: null, domain: 'go.test', visitsSummary: undefined })],
      });
      getShortUrlVisits.mockResolvedValue({ data: [], pagination: { totalItems: 0 } });

      const [pixel] = await service.listPixels();

      expect(pixel).toEqual(
        expect.objectContaining({
          name: 'abc123',
          domain: 'go.test',
          opens: 0,
          botHits: 0,
          opensLast7Days: 0,
          lastOpened: null,
        }),
      );
    });
  });

  it('lists domains', async () => {
    listDomains.mockResolvedValue({
      data: [
        { domain: 's.test', isDefault: true, redirects: {} },
        { domain: 'go.test', isDefault: false, redirects: {} },
      ],
    });

    expect(await service.listDomains()).toEqual([
      { domain: 's.test', isDefault: true },
      { domain: 'go.test', isDefault: false },
    ]);
  });

  describe('createPixel', () => {
    it.each([
      [{ name: ' ', fallbackUrl: 'https://example.com' }, 'A name is required'],
      [{ name: 'Sig', fallbackUrl: 'example.com' }, 'Fallback URL must be a valid http(s) URL'],
      [{ name: 'Sig', fallbackUrl: 'https://example.com', customSlug: 'a b' }, /can only contain/],
      [{ name: 'Sig', fallbackUrl: 'https://example.com', customSlug: 'admin-sig' }, /cannot use "admin"/],
    ])('validates input', async (data, message) => {
      const promise = service.createPixel(data);
      await expect(promise).rejects.toBeInstanceOf(PixelValidationError);
      await expect(promise).rejects.toThrow(message);
      expect(createShortUrl).not.toHaveBeenCalled();
    });

    it('creates a pixel with a custom slug', async () => {
      createShortUrl.mockResolvedValue(shortUrl({ shortCode: 'sig-open' }));

      await service.createPixel({
        name: ' Sig ',
        fallbackUrl: 'https://example.com',
        customSlug: ' sig-open ',
        domain: 'go.test',
      });

      expect(createShortUrl).toHaveBeenCalledWith({
        longUrl: 'https://example.com',
        title: 'Sig',
        tags: ['pixel'],
        crawlable: false,
        forwardQuery: false,
        domain: 'go.test',
        customSlug: 'sig-open',
      });
    });

    it('generates a short code when no slug is provided', async () => {
      createShortUrl.mockResolvedValue(shortUrl({ shortCode: 'xK3pQ9aZ' }));

      const result = await service.createPixel({ name: 'Sig', fallbackUrl: 'https://example.com', domain: '' });

      expect(result.shortCode).toEqual('xK3pQ9aZ');
      expect(createShortUrl).toHaveBeenCalledWith(expect.objectContaining({ shortCodeLength: 8, domain: undefined }));
      expect(deleteShortUrl).not.toHaveBeenCalled();
    });

    it('discards generated short codes blocked by the proxy', async () => {
      createShortUrl
        .mockResolvedValueOnce(shortUrl({ shortCode: 'Api3xk9Q', domain: 'go.test' }))
        .mockResolvedValueOnce(shortUrl({ shortCode: 'q7Rm2wLp', domain: 'go.test' }));

      const result = await service.createPixel({ name: 'Sig', fallbackUrl: 'https://example.com' });

      expect(result.shortCode).toEqual('q7Rm2wLp');
      expect(createShortUrl).toHaveBeenCalledTimes(2);
      expect(deleteShortUrl).toHaveBeenCalledWith({ shortCode: 'Api3xk9Q', domain: 'go.test' });
    });

    it('gives up after several blocked short codes', async () => {
      createShortUrl.mockResolvedValue(shortUrl({ shortCode: 'test1234' }));

      await expect(service.createPixel({ name: 'Sig', fallbackUrl: 'https://example.com' })).rejects.toThrow(
        'Could not generate a short code',
      );
      expect(createShortUrl).toHaveBeenCalledTimes(5);
      expect(deleteShortUrl).toHaveBeenCalledTimes(5);
    });
  });

  describe('renamePixel', () => {
    it('requires a name', async () => {
      await expect(service.renamePixel('abc', null, '  ')).rejects.toBeInstanceOf(PixelValidationError);
      expect(updateShortUrl).not.toHaveBeenCalled();
    });

    it('updates the short URL title', async () => {
      await service.renamePixel('abc', 'go.test', ' New name ');
      expect(updateShortUrl).toHaveBeenCalledWith({ shortCode: 'abc', domain: 'go.test' }, { title: 'New name' });
    });
  });

  it('deletes pixels', async () => {
    await service.deletePixel('abc', null);
    expect(deleteShortUrl).toHaveBeenCalledWith({ shortCode: 'abc', domain: null });
  });
});
