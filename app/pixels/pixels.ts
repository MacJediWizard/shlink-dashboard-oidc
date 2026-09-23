/**
 * Helpers for tracking pixels.
 *
 * A tracking pixel is a regular Shlink short URL tagged with PIXEL_TAG. Shlink serves a 1x1 transparent GIF on
 * `<short-url>/track` and records a visit, the same way it does for a click on `<short-url>`.
 */

export const PIXEL_TAG = 'pixel';

/**
 * Path prefixes rejected by the reverse proxy (NPM) security rules in front of Shlink. A pixel whose short code starts
 * with one of these would never reach Shlink, so it would silently record nothing.
 * Matching is case-insensitive, like the proxy rules.
 */
export const BLOCKED_PREFIXES = [
  'wp-admin',
  'wp-login',
  'wp-includes',
  'wp-content',
  'wordpress',
  'administrator',
  'admin',
  'login',
  'phpmyadmin',
  'pma',
  'mysql',
  'myadmin',
  'sqlmanager',
  'api',
  'feed',
  'xmlrpc',
  'wlwmanifest',
  'autodiscover',
  '_ignition',
  'telescope',
  'vendor',
  'debug',
  'console',
  'server-status',
  'server-info',
  'phpinfo',
  'info',
  'test',
  'adminer',
  'shell',
  'manager',
  'setup',
] as const;

/**
 * Words rejected by the reverse proxy anywhere in the path, not only at the beginning
 */
export const BLOCKED_SUBSTRINGS = ['wp-includes', 'wp-content', 'wlwmanifest', 'wp-login', 'xmlrpc'] as const;

const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Returns the blocked word that makes the reverse proxy reject this short code, if any
 */
export function blockedWordFor(shortCode: string): string | undefined {
  const lower = shortCode.toLowerCase();
  return (
    BLOCKED_PREFIXES.find((prefix) => lower.startsWith(prefix)) ??
    BLOCKED_SUBSTRINGS.find((word) => lower.includes(word))
  );
}

/**
 * Returns an error message if the custom slug cannot be used for a pixel, or undefined if it's valid
 */
export function validatePixelSlug(slug: string): string | undefined {
  if (!SLUG_PATTERN.test(slug)) {
    return 'Custom slug can only contain letters, numbers, dashes and underscores';
  }

  const blockedWord = blockedWordFor(slug);
  if (blockedWord) {
    return `Custom slug cannot use "${blockedWord}", as the proxy in front of Shlink blocks it`;
  }

  return undefined;
}

export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function buildPixelUrl(shortUrl: string): string {
  return `${shortUrl.replace(/\/+$/, '')}/track`;
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * HTML snippet to embed the pixel in an email signature or web page
 */
export function buildPixelSnippet(pixelUrl: string): string {
  return `<img src="${escapeHtmlAttribute(pixelUrl)}" width="1" height="1" alt="" style="display:none;border:0;" />`;
}

/**
 * Path to the short URL visits page provided by shlink-web-component
 */
export function buildVisitsPath(serverId: string, shortCode: string, domain: string | null): string {
  const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
  return `/server/${serverId}/short-code/${encodeURIComponent(shortCode)}/visits${query}`;
}
