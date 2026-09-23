import {
  blockedWordFor,
  buildPixelSnippet,
  buildPixelUrl,
  buildVisitsPath,
  isHttpUrl,
  validatePixelSlug,
} from '../../app/pixels/pixels';

describe('pixels', () => {
  describe('blockedWordFor', () => {
    it.each([
      ['admin-tips', 'admin'],
      ['API3xk', 'api'],
      ['InfoSession', 'info'],
      ['testflight', 'test'],
      ['my-wp-content-link', 'wp-content'],
    ])('detects blocked words in "%s"', (shortCode, expected) => {
      expect(blockedWordFor(shortCode)).toEqual(expected);
    });

    it.each([['sig-open'], ['newsletter'], ['aB3dE9fG'], ['my-admin']])('accepts "%s"', (shortCode) => {
      expect(blockedWordFor(shortCode)).toBeUndefined();
    });
  });

  describe('validatePixelSlug', () => {
    it('accepts valid slugs', () => {
      expect(validatePixelSlug('signature_open-2026')).toBeUndefined();
    });

    it.each([['with space'], ['dot.ted'], ['slash/es'], ['emoji🙂']])('rejects invalid characters in "%s"', (slug) => {
      expect(validatePixelSlug(slug)).toMatch(/can only contain/);
    });

    it('rejects slugs blocked by the proxy', () => {
      expect(validatePixelSlug('login-help')).toEqual(
        'Custom slug cannot use "login", as the proxy in front of Shlink blocks it',
      );
    });
  });

  describe('isHttpUrl', () => {
    it.each([
      ['https://example.com', true],
      ['http://example.com/path?x=1', true],
      ['ftp://example.com', false],
      ['javascript:alert(1)', false],
      ['not a url', false],
      ['', false],
    ])('checks "%s"', (value, expected) => {
      expect(isHttpUrl(value)).toEqual(expected);
    });
  });

  it('builds pixel URLs', () => {
    expect(buildPixelUrl('https://go.example.com/abc')).toEqual('https://go.example.com/abc/track');
    expect(buildPixelUrl('https://go.example.com/abc/')).toEqual('https://go.example.com/abc/track');
  });

  it('builds an escaped HTML snippet', () => {
    expect(buildPixelSnippet('https://go.example.com/a"b/track')).toEqual(
      '<img src="https://go.example.com/a&quot;b/track" width="1" height="1" alt="" style="display:none;border:0;" />',
    );
  });

  it.each([
    ['abc', null, '/server/srv/short-code/abc/visits'],
    ['abc', 'go.example.com', '/server/srv/short-code/abc/visits?domain=go.example.com'],
    ['a b', null, '/server/srv/short-code/a%20b/visits'],
  ])('builds visits path for "%s" on %s', (shortCode, domain, expected) => {
    expect(buildVisitsPath('srv', shortCode, domain)).toEqual(expected);
  });
});
