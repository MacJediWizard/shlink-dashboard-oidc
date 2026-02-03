import { fromPartial } from '@total-typescript/shoehorn';
import type * as clientTypes from 'openid-client';

const defaultOidcConfig = {
  issuerUrl: 'https://auth.example.com',
  clientId: 'client-id',
  clientSecret: 'secret',
  redirectUri: 'https://app.example.com/auth/callback',
  scopes: 'openid profile email groups',
  adminGroup: 'shlink-admins',
  advancedGroup: 'shlink-advanced',
  defaultRole: 'managed-user',
};

describe('oidc.server', () => {
  // Mock functions that will be used across tests
  const mockRandomState = vi.fn().mockReturnValue('mock-state');
  const mockRandomNonce = vi.fn().mockReturnValue('mock-nonce');
  const mockRandomPKCECodeVerifier = vi.fn().mockReturnValue('mock-verifier');
  const mockDiscovery = vi.fn();
  const mockCalculatePKCECodeChallenge = vi.fn().mockResolvedValue('mock-challenge');
  const mockBuildAuthorizationUrl = vi.fn().mockReturnValue(
    new URL('https://auth.example.com/authorize?client_id=test'),
  );
  const mockAuthorizationCodeGrant = vi.fn();
  const mockGetOidcConfig = vi.fn();
  const mockIsOidcEnabled = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Reset mock implementations
    mockDiscovery.mockReset();
    mockAuthorizationCodeGrant.mockReset();
    mockGetOidcConfig.mockReset();
    mockIsOidcEnabled.mockReset();

    // Set up mocks before each test
    vi.doMock('openid-client', () => ({
      randomState: mockRandomState,
      randomNonce: mockRandomNonce,
      randomPKCECodeVerifier: mockRandomPKCECodeVerifier,
      discovery: mockDiscovery,
      calculatePKCECodeChallenge: mockCalculatePKCECodeChallenge,
      buildAuthorizationUrl: mockBuildAuthorizationUrl,
      authorizationCodeGrant: mockAuthorizationCodeGrant,
    }));

    vi.doMock('../../app/utils/env.server', () => ({
      isOidcEnabled: mockIsOidcEnabled,
      getOidcConfig: mockGetOidcConfig,
    }));
  });

  describe('generateOidcState', () => {
    it('generates state, nonce, and codeVerifier', async () => {
      const { generateOidcState } = await import('../../app/auth/oidc.server');

      const state = generateOidcState();

      expect(state).toEqual({
        state: 'mock-state',
        nonce: 'mock-nonce',
        codeVerifier: 'mock-verifier',
      });
      expect(mockRandomState).toHaveBeenCalled();
      expect(mockRandomNonce).toHaveBeenCalled();
      expect(mockRandomPKCECodeVerifier).toHaveBeenCalled();
    });
  });

  describe('mapGroupsToRole', () => {
    it('returns managed-user when OIDC is not enabled', async () => {
      mockGetOidcConfig.mockReturnValue(null);
      const { mapGroupsToRole } = await import('../../app/auth/oidc.server');

      const role = mapGroupsToRole(['some-group']);

      expect(role).toBe('managed-user');
    });

    it('returns admin when user is in admin group', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      const { mapGroupsToRole } = await import('../../app/auth/oidc.server');

      const role = mapGroupsToRole(['some-group', 'shlink-admins']);

      expect(role).toBe('admin');
    });

    it('returns advanced-user when user is in advanced group but not admin', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      const { mapGroupsToRole } = await import('../../app/auth/oidc.server');

      const role = mapGroupsToRole(['some-group', 'shlink-advanced']);

      expect(role).toBe('advanced-user');
    });

    it('returns admin even when user is in both admin and advanced groups', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      const { mapGroupsToRole } = await import('../../app/auth/oidc.server');

      const role = mapGroupsToRole(['shlink-admins', 'shlink-advanced']);

      expect(role).toBe('admin');
    });

    it('returns default role when user is not in any configured group', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      const { mapGroupsToRole } = await import('../../app/auth/oidc.server');

      const role = mapGroupsToRole(['other-group']);

      expect(role).toBe('managed-user');
    });

    it('returns configured default role', async () => {
      mockGetOidcConfig.mockReturnValue({
        ...defaultOidcConfig,
        advancedGroup: undefined,
        defaultRole: 'advanced-user',
      });
      const { mapGroupsToRole } = await import('../../app/auth/oidc.server');

      const role = mapGroupsToRole([]);

      expect(role).toBe('advanced-user');
    });

    it('handles empty groups array', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      const { mapGroupsToRole } = await import('../../app/auth/oidc.server');

      const role = mapGroupsToRole([]);

      expect(role).toBe('managed-user');
    });

    it('handles undefined admin and advanced groups', async () => {
      mockGetOidcConfig.mockReturnValue({
        ...defaultOidcConfig,
        adminGroup: undefined,
        advancedGroup: undefined,
      });
      const { mapGroupsToRole } = await import('../../app/auth/oidc.server');

      const role = mapGroupsToRole(['some-group']);

      expect(role).toBe('managed-user');
    });
  });

  describe('buildAuthorizationUrl', () => {
    const mockClientConfig = fromPartial<clientTypes.Configuration>({});

    it('throws error when OIDC is not enabled', async () => {
      mockGetOidcConfig.mockReturnValue(null);
      const { buildAuthorizationUrl } = await import('../../app/auth/oidc.server');

      const oidcState = { state: 'state', nonce: 'nonce', codeVerifier: 'verifier' };

      await expect(buildAuthorizationUrl(oidcState)).rejects.toThrow('OIDC is not enabled');
    });

    it('builds authorization URL with correct parameters', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(mockClientConfig);
      const { buildAuthorizationUrl } = await import('../../app/auth/oidc.server');

      const oidcState = { state: 'test-state', nonce: 'test-nonce', codeVerifier: 'test-verifier' };
      const url = await buildAuthorizationUrl(oidcState);

      expect(mockCalculatePKCECodeChallenge).toHaveBeenCalledWith('test-verifier');
      expect(mockBuildAuthorizationUrl).toHaveBeenCalledWith(mockClientConfig, {
        redirect_uri: 'https://app.example.com/auth/callback',
        scope: 'openid profile email groups',
        state: 'test-state',
        nonce: 'test-nonce',
        code_challenge: 'mock-challenge',
        code_challenge_method: 'S256',
      });
      expect(url).toBe('https://auth.example.com/authorize?client_id=test');
    });

    it('calls discovery with correct parameters', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(mockClientConfig);
      const { buildAuthorizationUrl } = await import('../../app/auth/oidc.server');

      const oidcState = { state: 'state', nonce: 'nonce', codeVerifier: 'verifier' };
      await buildAuthorizationUrl(oidcState);

      expect(mockDiscovery).toHaveBeenCalledWith(
        new URL('https://auth.example.com'),
        'client-id',
        'secret',
      );
    });
  });

  describe('exchangeCodeForTokens', () => {
    const mockClientConfig = fromPartial<clientTypes.Configuration>({});
    const now = Math.floor(Date.now() / 1000);

    it('throws error when state does not match', async () => {
      const { exchangeCodeForTokens } = await import('../../app/auth/oidc.server');

      await expect(
        exchangeCodeForTokens('code', 'wrong-state', 'expected-state', 'nonce', 'verifier'),
      ).rejects.toThrow('Invalid state parameter');
    });

    it('throws error when OIDC is not enabled', async () => {
      mockGetOidcConfig.mockReturnValue(null);
      const { exchangeCodeForTokens } = await import('../../app/auth/oidc.server');

      await expect(
        exchangeCodeForTokens('code', 'state', 'state', 'nonce', 'verifier'),
      ).rejects.toThrow('OIDC is not enabled');
    });

    it('throws error when no claims in token', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(mockClientConfig);
      mockAuthorizationCodeGrant.mockResolvedValue(
        fromPartial({ claims: () => null }),
      );
      const { exchangeCodeForTokens } = await import('../../app/auth/oidc.server');

      await expect(
        exchangeCodeForTokens('code', 'state', 'state', 'nonce', 'verifier'),
      ).rejects.toThrow('No claims in ID token');
    });

    it('throws error when token has expired', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(mockClientConfig);
      mockAuthorizationCodeGrant.mockResolvedValue(
        fromPartial({
          claims: () => ({
            sub: 'user-123',
            exp: now - 120,
            iat: now - 300,
            nonce: 'nonce',
          }),
        }),
      );
      const { exchangeCodeForTokens } = await import('../../app/auth/oidc.server');

      await expect(
        exchangeCodeForTokens('code', 'state', 'state', 'nonce', 'verifier'),
      ).rejects.toThrow('ID token has expired');
    });

    it('throws error when token issued in future', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(mockClientConfig);
      mockAuthorizationCodeGrant.mockResolvedValue(
        fromPartial({
          claims: () => ({
            sub: 'user-123',
            exp: now + 3600,
            iat: now + 120,
            nonce: 'nonce',
          }),
        }),
      );
      const { exchangeCodeForTokens } = await import('../../app/auth/oidc.server');

      await expect(
        exchangeCodeForTokens('code', 'state', 'state', 'nonce', 'verifier'),
      ).rejects.toThrow('ID token issued in the future');
    });

    it('throws error when nonce does not match', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(mockClientConfig);
      mockAuthorizationCodeGrant.mockResolvedValue(
        fromPartial({
          claims: () => ({
            sub: 'user-123',
            exp: now + 3600,
            iat: now,
            nonce: 'wrong-nonce',
          }),
        }),
      );
      const { exchangeCodeForTokens } = await import('../../app/auth/oidc.server');

      await expect(
        exchangeCodeForTokens('code', 'state', 'state', 'correct-nonce', 'verifier'),
      ).rejects.toThrow('ID token nonce mismatch');
    });

    it('returns claims on successful token exchange', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(mockClientConfig);
      mockAuthorizationCodeGrant.mockResolvedValue(
        fromPartial({
          claims: () => ({
            sub: 'user-123',
            email: 'user@example.com',
            preferred_username: 'testuser',
            name: 'Test User',
            groups: ['users', 'admins'],
            exp: now + 3600,
            iat: now,
            nonce: 'nonce',
          }),
        }),
      );
      const { exchangeCodeForTokens } = await import('../../app/auth/oidc.server');

      const claims = await exchangeCodeForTokens('code', 'state', 'state', 'nonce', 'verifier');

      expect(claims).toEqual({
        sub: 'user-123',
        email: 'user@example.com',
        preferred_username: 'testuser',
        name: 'Test User',
        groups: ['users', 'admins'],
      });
    });

    it('handles missing optional claims', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(mockClientConfig);
      mockAuthorizationCodeGrant.mockResolvedValue(
        fromPartial({
          claims: () => ({
            sub: 'user-123',
            exp: now + 3600,
            iat: now,
            nonce: 'nonce',
          }),
        }),
      );
      const { exchangeCodeForTokens } = await import('../../app/auth/oidc.server');

      const claims = await exchangeCodeForTokens('code', 'state', 'state', 'nonce', 'verifier');

      expect(claims).toEqual({
        sub: 'user-123',
        email: undefined,
        preferred_username: undefined,
        name: undefined,
        groups: [],
      });
    });

    it('handles non-array groups claim', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(mockClientConfig);
      mockAuthorizationCodeGrant.mockResolvedValue(
        fromPartial({
          claims: () => ({
            sub: 'user-123',
            groups: 'not-an-array',
            exp: now + 3600,
            iat: now,
            nonce: 'nonce',
          }),
        }),
      );
      const { exchangeCodeForTokens } = await import('../../app/auth/oidc.server');

      const claims = await exchangeCodeForTokens('code', 'state', 'state', 'nonce', 'verifier');

      expect(claims.groups).toEqual([]);
    });

    it('calls authorizationCodeGrant with correct parameters', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(mockClientConfig);
      mockAuthorizationCodeGrant.mockResolvedValue(
        fromPartial({
          claims: () => ({
            sub: 'user-123',
            exp: now + 3600,
            iat: now,
            nonce: 'nonce-456',
          }),
        }),
      );
      const { exchangeCodeForTokens } = await import('../../app/auth/oidc.server');

      await exchangeCodeForTokens('auth-code', 'state-123', 'state-123', 'nonce-456', 'verifier-789');

      expect(mockAuthorizationCodeGrant).toHaveBeenCalledWith(
        mockClientConfig,
        expect.any(URL),
        {
          pkceCodeVerifier: 'verifier-789',
          expectedNonce: 'nonce-456',
          expectedState: 'state-123',
        },
      );
    });
  });

  describe('getLogoutUrl', () => {
    it('returns null when OIDC is not enabled', async () => {
      mockGetOidcConfig.mockReturnValue(null);
      const { getLogoutUrl } = await import('../../app/auth/oidc.server');

      const url = await getLogoutUrl();

      expect(url).toBeNull();
    });

    it('returns null when no end_session_endpoint', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(
        fromPartial({
          serverMetadata: () => ({}),
        }),
      );
      const { getLogoutUrl } = await import('../../app/auth/oidc.server');

      const url = await getLogoutUrl();

      expect(url).toBeNull();
    });

    it('returns logout URL without id_token_hint', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(
        fromPartial({
          serverMetadata: () => ({
            end_session_endpoint: 'https://auth.example.com/logout',
          }),
        }),
      );
      const { getLogoutUrl } = await import('../../app/auth/oidc.server');

      const url = await getLogoutUrl();

      expect(url).not.toBeNull();
      expect(url).toContain('https://auth.example.com/logout');
      expect(url).toContain('post_logout_redirect_uri');
    });

    it('returns logout URL with id_token_hint when provided', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockResolvedValue(
        fromPartial({
          serverMetadata: () => ({
            end_session_endpoint: 'https://auth.example.com/logout',
          }),
        }),
      );
      const { getLogoutUrl } = await import('../../app/auth/oidc.server');

      const url = await getLogoutUrl('my-id-token');

      expect(url).not.toBeNull();
      expect(url).toContain('id_token_hint=my-id-token');
    });

    it('returns null when discovery fails', async () => {
      mockGetOidcConfig.mockReturnValue(defaultOidcConfig);
      mockDiscovery.mockRejectedValue(new Error('Discovery failed'));
      const { getLogoutUrl } = await import('../../app/auth/oidc.server');

      const url = await getLogoutUrl();

      expect(url).toBeNull();
    });
  });
});
