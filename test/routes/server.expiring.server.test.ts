import { fromPartial } from '@total-typescript/shoehorn';
import type { LoaderFunctionArgs } from 'react-router';
import { loader } from '../../app/routes/server.$serverId.expiring';
import type { ServersService } from '../../app/servers/ServersService.server';

describe('server.$serverId.expiring', () => {
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

  const listShortUrls = vi.fn();
  const mockApiClientBuilder = vi.fn().mockReturnValue({
    listShortUrls,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getByPublicIdAndUser.mockResolvedValue(mockServer);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('loader', () => {
    it('throws 400 when serverId is missing', async () => {
      const args = fromPartial<LoaderFunctionArgs>({
        params: {},
        context: mockContext,
      });

      try {
        await loader(args, serversService, mockApiClientBuilder);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(400);
      }
    });

    it('returns expiring URLs within 30 days', async () => {
      const shortUrls = {
        data: [
          {
            shortCode: 'abc',
            shortUrl: 'https://shlink.example.com/abc',
            longUrl: 'https://example.com/page1',
            title: 'Expiring Soon',
            meta: { validUntil: '2026-01-20T12:00:00Z' }, // 5 days from now
          },
          {
            shortCode: 'def',
            shortUrl: 'https://shlink.example.com/def',
            longUrl: 'https://example.com/page2',
            title: null,
            meta: { validUntil: '2026-02-10T12:00:00Z' }, // 26 days from now
          },
          {
            shortCode: 'ghi',
            shortUrl: 'https://shlink.example.com/ghi',
            longUrl: 'https://example.com/page3',
            title: 'No Expiration',
            meta: {}, // No validUntil
          },
          {
            shortCode: 'jkl',
            shortUrl: 'https://shlink.example.com/jkl',
            longUrl: 'https://example.com/page4',
            title: 'Already Expired',
            meta: { validUntil: '2026-01-10T12:00:00Z' }, // Already passed
          },
          {
            shortCode: 'mno',
            shortUrl: 'https://shlink.example.com/mno',
            longUrl: 'https://example.com/page5',
            title: 'Far Future',
            meta: { validUntil: '2027-01-01T12:00:00Z' }, // More than 30 days
          },
        ],
      };
      listShortUrls.mockResolvedValue(shortUrls);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const result = await loader(args, serversService, mockApiClientBuilder);

      expect(result.serverId).toBe('server-1');
      expect(result.serverName).toBe('Test Server');
      expect(result.expiringUrls).toHaveLength(2);
      // Should be sorted by days until expiration (soonest first)
      expect(result.expiringUrls[0].shortCode).toBe('abc');
      expect(result.expiringUrls[0].daysUntilExpiration).toBe(5);
      expect(result.expiringUrls[1].shortCode).toBe('def');
      expect(result.expiringUrls[1].daysUntilExpiration).toBe(26);
    });

    it('returns empty array when no URLs are expiring', async () => {
      const shortUrls = {
        data: [
          {
            shortCode: 'abc',
            shortUrl: 'https://shlink.example.com/abc',
            longUrl: 'https://example.com/page1',
            title: 'No Expiration',
            meta: {},
          },
        ],
      };
      listShortUrls.mockResolvedValue(shortUrls);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const result = await loader(args, serversService, mockApiClientBuilder);

      expect(result.expiringUrls).toHaveLength(0);
    });

    it('handles API errors gracefully', async () => {
      listShortUrls.mockRejectedValue(new Error('API Error'));

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const result = await loader(args, serversService, mockApiClientBuilder);

      expect(result.serverId).toBe('server-1');
      expect(result.expiringUrls).toEqual([]);
      expect(result.error).toBe('API Error');
    });

    it('handles URLs with title being null', async () => {
      const shortUrls = {
        data: [
          {
            shortCode: 'abc',
            shortUrl: 'https://shlink.example.com/abc',
            longUrl: 'https://example.com/page1',
            title: null,
            meta: { validUntil: '2026-01-20T12:00:00Z' },
          },
        ],
      };
      listShortUrls.mockResolvedValue(shortUrls);

      const args = fromPartial<LoaderFunctionArgs>({
        params: { serverId: 'server-1' },
        context: mockContext,
      });

      const result = await loader(args, serversService, mockApiClientBuilder);

      expect(result.expiringUrls[0].title).toBeNull();
    });
  });
});
