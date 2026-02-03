import { fromPartial } from '@total-typescript/shoehorn';
import type { LoaderFunctionArgs } from 'react-router';
import type { AuthHelper } from '../../../app/auth/auth-helper.server';
import type { UsersService } from '../../../app/users/UsersService.server';
import { loader } from '../../../app/routes/auth/callback';

vi.mock('../../../app/auth/oidc.server', () => ({
  isOidcEnabled: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
}));

vi.mock('../../../app/utils/env.server', () => ({
  isProd: vi.fn().mockReturnValue(false),
}));

import { exchangeCodeForTokens, isOidcEnabled } from '../../../app/auth/oidc.server';

const mockedIsOidcEnabled = vi.mocked(isOidcEnabled);
const mockedExchangeCodeForTokens = vi.mocked(exchangeCodeForTokens);

describe('auth/callback', () => {
  const loginWithOidc = vi.fn();
  const authHelper = fromPartial<AuthHelper>({ loginWithOidc });

  const findOrCreateFromOidcClaims = vi.fn();
  const usersService = fromPartial<UsersService>({ findOrCreateFromOidcClaims });

  const buildRequest = (url: string, cookies?: string) => {
    const headers = new Headers();
    if (cookies) {
      headers.set('cookie', cookies);
    }
    return fromPartial<Request>({
      url,
      headers,
    });
  };

  const buildLoaderArgs = (request: Request): LoaderFunctionArgs => fromPartial({
    request,
    context: new Map(),
    params: {},
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loader', () => {
    it('redirects to login when OIDC is not enabled', async () => {
      mockedIsOidcEnabled.mockReturnValue(false);
      const request = buildRequest('https://example.com/auth/callback?code=abc&state=xyz');

      const response = await loader(buildLoaderArgs(request), authHelper, usersService);

      expect(response.headers.get('Location')).toBe('/login');
    });

    it('redirects to login with error when OIDC provider returns error', async () => {
      mockedIsOidcEnabled.mockReturnValue(true);
      const request = buildRequest('https://example.com/auth/callback?error=access_denied&error_description=User%20denied');

      const response = await loader(buildLoaderArgs(request), authHelper, usersService);

      expect(response.headers.get('Location')).toContain('/login?error=');
    });

    it('redirects to login with error when code is missing', async () => {
      mockedIsOidcEnabled.mockReturnValue(true);
      const request = buildRequest('https://example.com/auth/callback?state=xyz');

      const response = await loader(buildLoaderArgs(request), authHelper, usersService);

      expect(response.headers.get('Location')).toContain('/login?error=');
    });

    it('redirects to login with error when state is missing', async () => {
      mockedIsOidcEnabled.mockReturnValue(true);
      const request = buildRequest('https://example.com/auth/callback?code=abc');

      const response = await loader(buildLoaderArgs(request), authHelper, usersService);

      expect(response.headers.get('Location')).toContain('/login?error=');
    });

    it('redirects to login with error when OIDC state cookie is missing', async () => {
      mockedIsOidcEnabled.mockReturnValue(true);
      const request = buildRequest('https://example.com/auth/callback?code=abc&state=xyz');

      const response = await loader(buildLoaderArgs(request), authHelper, usersService);

      expect(response.headers.get('Location')).toContain('/login?error=');
    });

    it('redirects to login with error when OIDC state cookie is invalid JSON', async () => {
      mockedIsOidcEnabled.mockReturnValue(true);
      const request = buildRequest(
        'https://example.com/auth/callback?code=abc&state=xyz',
        'oidc_state=invalid-json',
      );

      const response = await loader(buildLoaderArgs(request), authHelper, usersService);

      expect(response.headers.get('Location')).toContain('/login?error=');
    });

    it('redirects to login with error when token exchange fails', async () => {
      mockedIsOidcEnabled.mockReturnValue(true);
      mockedExchangeCodeForTokens.mockRejectedValue(new Error('Token exchange failed'));

      const oidcState = JSON.stringify({
        state: 'xyz',
        nonce: 'nonce123',
        codeVerifier: 'verifier123',
      });
      const request = buildRequest(
        'https://example.com/auth/callback?code=abc&state=xyz',
        `oidc_state=${encodeURIComponent(oidcState)}`,
      );

      const response = await loader(buildLoaderArgs(request), authHelper, usersService);

      expect(response.headers.get('Location')).toContain('/login?error=');
    });

    it('creates session and redirects on successful authentication', async () => {
      mockedIsOidcEnabled.mockReturnValue(true);
      mockedExchangeCodeForTokens.mockResolvedValue({
        sub: 'user-123',
        email: 'user@example.com',
        preferred_username: 'testuser',
        name: 'Test User',
        groups: ['users'],
      });

      const mockUser = {
        publicId: 'pub-123',
        username: 'testuser',
        displayName: 'Test User',
        role: 'managed-user' as const,
        tempPassword: false,
        password: 'hashed',
        createdAt: new Date(),
        oidcSubject: 'user-123',
      };
      findOrCreateFromOidcClaims.mockResolvedValue(mockUser);

      const mockResponse = new Response(null, {
        status: 302,
        headers: { Location: '/' },
      });
      loginWithOidc.mockResolvedValue(mockResponse);

      const oidcState = JSON.stringify({
        state: 'xyz',
        nonce: 'nonce123',
        codeVerifier: 'verifier123',
        redirectTo: '/dashboard',
      });
      const request = buildRequest(
        'https://example.com/auth/callback?code=abc&state=xyz',
        `oidc_state=${encodeURIComponent(oidcState)}`,
      );

      const response = await loader(buildLoaderArgs(request), authHelper, usersService);

      expect(mockedExchangeCodeForTokens).toHaveBeenCalledWith(
        'abc',
        'xyz',
        'xyz',
        'nonce123',
        'verifier123',
      );
      expect(findOrCreateFromOidcClaims).toHaveBeenCalledWith({
        sub: 'user-123',
        email: 'user@example.com',
        preferred_username: 'testuser',
        name: 'Test User',
        groups: ['users'],
      });
      expect(loginWithOidc).toHaveBeenCalledWith(request, mockUser, '/dashboard');
      expect(response.headers.get('Set-Cookie')).toContain('oidc_state=');
    });
  });
});
