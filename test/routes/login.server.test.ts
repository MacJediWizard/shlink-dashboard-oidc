import { fromPartial } from '@total-typescript/shoehorn';
import type { AuthHelper } from '../../app/auth/auth-helper.server';
import { action, loader } from '../../app/routes/login';

vi.mock('../../app/auth/oidc.server', () => ({
  isOidcEnabled: vi.fn(),
  generateOidcState: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
}));

vi.mock('../../app/utils/env.server', () => ({
  isLocalAuthEnabled: vi.fn().mockReturnValue(true),
  getOidcProviderName: vi.fn().mockReturnValue('SSO'),
  isProd: vi.fn().mockReturnValue(false),
}));

import { buildAuthorizationUrl, generateOidcState, isOidcEnabled } from '../../app/auth/oidc.server';
import { getOidcProviderName, isLocalAuthEnabled } from '../../app/utils/env.server';

const mockedIsOidcEnabled = vi.mocked(isOidcEnabled);
const mockedGenerateOidcState = vi.mocked(generateOidcState);
const mockedBuildAuthorizationUrl = vi.mocked(buildAuthorizationUrl);
const mockedIsLocalAuthEnabled = vi.mocked(isLocalAuthEnabled);
const mockedGetOidcProviderName = vi.mocked(getOidcProviderName);

describe('login', () => {
  const login = vi.fn().mockResolvedValue(fromPartial({}));
  const isAuthenticated = vi.fn().mockResolvedValue(undefined);
  const authHelper = fromPartial<AuthHelper>({ login, isAuthenticated });

  const createMockRequest = (formData: FormData = new FormData(), url = 'https://example.com/login') => {
    const request = fromPartial<Request>({
      url,
      clone: () => fromPartial<Request>({
        formData: () => Promise.resolve(formData),
      }),
    });
    return request;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsOidcEnabled.mockReturnValue(false);
    mockedIsLocalAuthEnabled.mockReturnValue(true);
    mockedGetOidcProviderName.mockReturnValue('SSO');
  });

  describe('action', () => {
    it('authenticates user with local auth', async () => {
      const formData = new FormData();
      formData.set('username', 'testuser');
      formData.set('password', 'testpass');
      const request = createMockRequest(formData);

      await action(fromPartial({ request }), authHelper);

      expect(login).toHaveBeenCalledWith(request);
    });

    it.each([
      { message: 'Incorrect password' },
      { message: 'User not found' },
    ])('returns json response when credentials are incorrect', async ({ message }) => {
      login.mockRejectedValue(new Error(message));

      const formData = new FormData();
      const request = createMockRequest(formData);
      const response = await action(fromPartial({ request }), authHelper);

      expect(response).toEqual({ error: true });
    });

    it('re-throws unknown errors', async () => {
      const e = new Error('Unknown error');
      const formData = new FormData();
      const request = createMockRequest(formData);

      login.mockRejectedValue(e);

      await expect(() => action(fromPartial({ request }), authHelper)).rejects.toEqual(e);
    });

    it('returns error when OIDC intent but OIDC is not enabled', async () => {
      mockedIsOidcEnabled.mockReturnValue(false);

      const formData = new FormData();
      formData.set('intent', 'oidc');
      const request = createMockRequest(formData);

      const response = await action(fromPartial({ request }), authHelper);

      expect(response).toEqual({ error: true, message: 'OIDC is not enabled' });
    });

    it('redirects to OIDC provider when OIDC intent and enabled', async () => {
      mockedIsOidcEnabled.mockReturnValue(true);
      mockedGenerateOidcState.mockReturnValue({
        state: 'test-state',
        nonce: 'test-nonce',
        codeVerifier: 'test-verifier',
      });
      mockedBuildAuthorizationUrl.mockResolvedValue('https://auth.example.com/authorize');

      const formData = new FormData();
      formData.set('intent', 'oidc');
      const request = createMockRequest(formData);

      const response = await action(fromPartial({ request }), authHelper);

      expect(response.headers.get('Location')).toBe('https://auth.example.com/authorize');
      expect(response.headers.get('Set-Cookie')).toContain('oidc_state=');
    });

    it('includes redirect-to in OIDC state cookie', async () => {
      mockedIsOidcEnabled.mockReturnValue(true);
      mockedGenerateOidcState.mockReturnValue({
        state: 'test-state',
        nonce: 'test-nonce',
        codeVerifier: 'test-verifier',
      });
      mockedBuildAuthorizationUrl.mockResolvedValue('https://auth.example.com/authorize');

      const formData = new FormData();
      formData.set('intent', 'oidc');
      formData.set('redirect-to', '/dashboard');
      const request = createMockRequest(formData);

      const response = await action(fromPartial({ request }), authHelper);

      const cookie = response.headers.get('Set-Cookie') ?? '';
      const decodedCookie = decodeURIComponent(cookie);
      expect(decodedCookie).toContain('/dashboard');
    });
  });

  describe('loader', () => {
    it('redirects if user is authenticated', async () => {
      isAuthenticated.mockResolvedValue(true);

      const request = fromPartial<Request>({ url: 'https://example.com/login' });
      const response = await loader(fromPartial({ request }), authHelper);

      expect(response).instanceof(Response);
      expect(response.headers.get('Location')).toBe('/');
    });

    it('returns auth config if user is not authenticated', async () => {
      isAuthenticated.mockResolvedValue(false);
      mockedIsOidcEnabled.mockReturnValue(false);
      mockedIsLocalAuthEnabled.mockReturnValue(true);
      mockedGetOidcProviderName.mockReturnValue('SSO');

      const request = fromPartial<Request>({ url: 'https://example.com/login' });
      const response = await loader(fromPartial({ request }), authHelper);

      expect(response).toEqual({ oidcEnabled: false, localAuthEnabled: true, oidcProviderName: 'SSO' });
    });

    it('auto-redirects to OIDC when enabled and local auth disabled', async () => {
      isAuthenticated.mockResolvedValue(false);
      mockedIsOidcEnabled.mockReturnValue(true);
      mockedIsLocalAuthEnabled.mockReturnValue(false);
      mockedGenerateOidcState.mockReturnValue({
        state: 'test-state',
        nonce: 'test-nonce',
        codeVerifier: 'test-verifier',
      });
      mockedBuildAuthorizationUrl.mockResolvedValue('https://auth.example.com/authorize');

      const request = fromPartial<Request>({ url: 'https://example.com/login' });
      const response = await loader(fromPartial({ request }), authHelper);

      expect(response.headers.get('Location')).toBe('https://auth.example.com/authorize');
      expect(response.headers.get('Set-Cookie')).toContain('oidc_state=');
    });

    it('returns config when OIDC enabled but local auth also enabled', async () => {
      isAuthenticated.mockResolvedValue(false);
      mockedIsOidcEnabled.mockReturnValue(true);
      mockedIsLocalAuthEnabled.mockReturnValue(true);
      mockedGetOidcProviderName.mockReturnValue('Authentik');

      const request = fromPartial<Request>({ url: 'https://example.com/login' });
      const response = await loader(fromPartial({ request }), authHelper);

      expect(response).toEqual({
        oidcEnabled: true,
        localAuthEnabled: true,
        oidcProviderName: 'Authentik',
      });
    });

    it('includes redirect-to in OIDC state when auto-redirecting', async () => {
      isAuthenticated.mockResolvedValue(false);
      mockedIsOidcEnabled.mockReturnValue(true);
      mockedIsLocalAuthEnabled.mockReturnValue(false);
      mockedGenerateOidcState.mockReturnValue({
        state: 'test-state',
        nonce: 'test-nonce',
        codeVerifier: 'test-verifier',
      });
      mockedBuildAuthorizationUrl.mockResolvedValue('https://auth.example.com/authorize');

      const request = fromPartial<Request>({
        url: 'https://example.com/login?redirect-to=/dashboard',
      });
      const response = await loader(fromPartial({ request }), authHelper);

      const cookie = response.headers.get('Set-Cookie') ?? '';
      const decodedCookie = decodeURIComponent(cookie);
      expect(decodedCookie).toContain('/dashboard');
    });
  });
});
