import type { ShlinkApiClient, ShlinkShortUrl } from '@shlinkio/shlink-js-sdk/api-contract';
import { blockedWordFor, buildPixelUrl, isHttpUrl, PIXEL_TAG, validatePixelSlug } from './pixels';

export type Pixel = {
  shortCode: string;
  /** Null when the pixel belongs to the default domain */
  domain: string | null;
  shortUrl: string;
  pixelUrl: string;
  name: string;
  fallbackUrl: string;
  dateCreated: string;
  opens: number;
  botHits: number;
  opensLast7Days: number;
  lastOpened: string | null;
};

export type PixelDomain = {
  domain: string;
  isDefault: boolean;
};

export type CreatePixelData = {
  name: string;
  fallbackUrl: string;
  customSlug?: string;
  domain?: string;
};

export class PixelValidationError extends Error {}

const MAX_PIXELS = 200;
const RECENT_DAYS = 7;
const GENERATED_CODE_LENGTH = 8;
const MAX_GENERATION_ATTEMPTS = 5;

export class PixelsService {
  readonly #apiClient: ShlinkApiClient;

  constructor(apiClient: ShlinkApiClient) {
    this.#apiClient = apiClient;
  }

  async listPixels(now: Date = new Date()): Promise<Pixel[]> {
    const { data } = await this.#apiClient.listShortUrls({
      tags: [PIXEL_TAG],
      itemsPerPage: MAX_PIXELS,
      orderBy: { field: 'dateCreated', dir: 'DESC' },
    });
    const recentStartDate = new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();

    return Promise.all(data.map((shortUrl) => this.#toPixel(shortUrl, recentStartDate)));
  }

  async listDomains(): Promise<PixelDomain[]> {
    const { data } = await this.#apiClient.listDomains();
    return data.map(({ domain, isDefault }) => ({ domain, isDefault }));
  }

  async createPixel({ name, fallbackUrl, customSlug, domain }: CreatePixelData): Promise<ShlinkShortUrl> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new PixelValidationError('A name is required');
    }
    if (!isHttpUrl(fallbackUrl)) {
      throw new PixelValidationError('Fallback URL must be a valid http(s) URL');
    }

    const slug = customSlug?.trim();
    if (slug) {
      const slugError = validatePixelSlug(slug);
      if (slugError) {
        throw new PixelValidationError(slugError);
      }
    }

    const create = () =>
      this.#apiClient.createShortUrl({
        longUrl: fallbackUrl,
        title: trimmedName,
        tags: [PIXEL_TAG],
        crawlable: false,
        forwardQuery: false,
        domain: domain || undefined,
        ...(slug ? { customSlug: slug } : { shortCodeLength: GENERATED_CODE_LENGTH }),
      });

    if (slug) {
      return create();
    }

    // Generated short codes could randomly start with a word the proxy blocks. Discard those and try again.
    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
      const shortUrl = await create();
      if (!blockedWordFor(shortUrl.shortCode)) {
        return shortUrl;
      }
      await this.#apiClient.deleteShortUrl({ shortCode: shortUrl.shortCode, domain: shortUrl.domain });
    }

    throw new Error('Could not generate a short code accepted by the proxy. Please try again');
  }

  async renamePixel(shortCode: string, domain: string | null, name: string): Promise<void> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new PixelValidationError('A name is required');
    }

    await this.#apiClient.updateShortUrl({ shortCode, domain }, { title: trimmedName });
  }

  async deletePixel(shortCode: string, domain: string | null): Promise<void> {
    await this.#apiClient.deleteShortUrl({ shortCode, domain });
  }

  async #toPixel(shortUrl: ShlinkShortUrl, recentStartDate: string): Promise<Pixel> {
    const identifier = { shortCode: shortUrl.shortCode, domain: shortUrl.domain };
    const [latest, recent] = await Promise.all([
      this.#apiClient.getShortUrlVisits(identifier, { itemsPerPage: 1, excludeBots: true }),
      this.#apiClient.getShortUrlVisits(identifier, {
        itemsPerPage: 1,
        excludeBots: true,
        startDate: recentStartDate,
      }),
    ]);

    return {
      shortCode: shortUrl.shortCode,
      domain: shortUrl.domain ?? null,
      shortUrl: shortUrl.shortUrl,
      pixelUrl: buildPixelUrl(shortUrl.shortUrl),
      name: shortUrl.title || shortUrl.shortCode,
      fallbackUrl: shortUrl.longUrl,
      dateCreated: shortUrl.dateCreated,
      opens: shortUrl.visitsSummary?.nonBots ?? 0,
      botHits: shortUrl.visitsSummary?.bots ?? 0,
      opensLast7Days: recent.pagination.totalItems,
      lastOpened: latest.data[0]?.date ?? null,
    };
  }
}
