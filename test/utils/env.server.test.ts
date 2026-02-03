describe('env.server', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isOidcEnabled', () => {
    it('returns false when OIDC is not enabled', async () => {
      process.env.SHLINK_DASHBOARD_OIDC_ENABLED = 'false';
      const { isOidcEnabled } = await import('../../app/utils/env.server');

      expect(isOidcEnabled()).toBe(false);
    });

    it('returns true when OIDC is enabled', async () => {
      process.env.SHLINK_DASHBOARD_OIDC_ENABLED = 'true';
      const { isOidcEnabled } = await import('../../app/utils/env.server');

      expect(isOidcEnabled()).toBe(true);
    });
  });

  describe('isLocalAuthEnabled', () => {
    it('returns true by default', async () => {
      const { isLocalAuthEnabled } = await import('../../app/utils/env.server');

      expect(isLocalAuthEnabled()).toBe(true);
    });

    it('returns false when explicitly disabled', async () => {
      process.env.SHLINK_DASHBOARD_LOCAL_AUTH_ENABLED = 'false';
      const { isLocalAuthEnabled } = await import('../../app/utils/env.server');

      expect(isLocalAuthEnabled()).toBe(false);
    });

    it('returns true when explicitly enabled', async () => {
      process.env.SHLINK_DASHBOARD_LOCAL_AUTH_ENABLED = 'true';
      const { isLocalAuthEnabled } = await import('../../app/utils/env.server');

      expect(isLocalAuthEnabled()).toBe(true);
    });
  });

  describe('getOidcProviderName', () => {
    it('returns SSO by default', async () => {
      const { getOidcProviderName } = await import('../../app/utils/env.server');

      expect(getOidcProviderName()).toBe('SSO');
    });

    it('returns custom provider name when set', async () => {
      process.env.SHLINK_DASHBOARD_OIDC_PROVIDER_NAME = 'Authentik';
      const { getOidcProviderName } = await import('../../app/utils/env.server');

      expect(getOidcProviderName()).toBe('Authentik');
    });
  });

  describe('getOidcConfig', () => {
    it('returns null when OIDC is not enabled', async () => {
      process.env.SHLINK_DASHBOARD_OIDC_ENABLED = 'false';
      const { getOidcConfig } = await import('../../app/utils/env.server');

      expect(getOidcConfig()).toBeNull();
    });

    it('throws error when OIDC enabled but missing required config', async () => {
      process.env.SHLINK_DASHBOARD_OIDC_ENABLED = 'true';
      // Missing required fields

      const { getOidcConfig } = await import('../../app/utils/env.server');

      expect(() => getOidcConfig()).toThrow('OIDC is enabled but missing required configuration');
    });

    it('throws error when missing client ID', async () => {
      process.env.SHLINK_DASHBOARD_OIDC_ENABLED = 'true';
      process.env.SHLINK_DASHBOARD_OIDC_ISSUER_URL = 'https://auth.example.com';
      process.env.SHLINK_DASHBOARD_OIDC_CLIENT_SECRET = 'secret';
      process.env.SHLINK_DASHBOARD_OIDC_REDIRECT_URI = 'https://app.example.com/callback';

      const { getOidcConfig } = await import('../../app/utils/env.server');

      expect(() => getOidcConfig()).toThrow('OIDC is enabled but missing required configuration');
    });

    it('returns config when all required fields are set', async () => {
      process.env.SHLINK_DASHBOARD_OIDC_ENABLED = 'true';
      process.env.SHLINK_DASHBOARD_OIDC_ISSUER_URL = 'https://auth.example.com';
      process.env.SHLINK_DASHBOARD_OIDC_CLIENT_ID = 'client-id';
      process.env.SHLINK_DASHBOARD_OIDC_CLIENT_SECRET = 'secret';
      process.env.SHLINK_DASHBOARD_OIDC_REDIRECT_URI = 'https://app.example.com/callback';

      const { getOidcConfig } = await import('../../app/utils/env.server');
      const config = getOidcConfig();

      expect(config).toEqual({
        issuerUrl: 'https://auth.example.com',
        clientId: 'client-id',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/callback',
        scopes: 'openid profile email groups',
        adminGroup: undefined,
        advancedGroup: undefined,
        defaultRole: 'managed-user',
      });
    });

    it('returns config with all optional fields', async () => {
      process.env.SHLINK_DASHBOARD_OIDC_ENABLED = 'true';
      process.env.SHLINK_DASHBOARD_OIDC_ISSUER_URL = 'https://auth.example.com';
      process.env.SHLINK_DASHBOARD_OIDC_CLIENT_ID = 'client-id';
      process.env.SHLINK_DASHBOARD_OIDC_CLIENT_SECRET = 'secret';
      process.env.SHLINK_DASHBOARD_OIDC_REDIRECT_URI = 'https://app.example.com/callback';
      process.env.SHLINK_DASHBOARD_OIDC_SCOPES = 'openid profile email';
      process.env.SHLINK_DASHBOARD_OIDC_ADMIN_GROUP = 'admins';
      process.env.SHLINK_DASHBOARD_OIDC_ADVANCED_GROUP = 'advanced';
      process.env.SHLINK_DASHBOARD_OIDC_DEFAULT_ROLE = 'advanced-user';

      const { getOidcConfig } = await import('../../app/utils/env.server');
      const config = getOidcConfig();

      expect(config).toEqual({
        issuerUrl: 'https://auth.example.com',
        clientId: 'client-id',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/callback',
        scopes: 'openid profile email',
        adminGroup: 'admins',
        advancedGroup: 'advanced',
        defaultRole: 'advanced-user',
      });
    });
  });

  describe('isProd', () => {
    it('returns false when NODE_ENV is not production', async () => {
      process.env.NODE_ENV = 'development';
      const { isProd } = await import('../../app/utils/env.server');

      expect(isProd()).toBe(false);
    });

    it('returns true when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';
      const { isProd } = await import('../../app/utils/env.server');

      expect(isProd()).toBe(true);
    });

    it('returns false when NODE_ENV is test', async () => {
      process.env.NODE_ENV = 'test';
      const { isProd } = await import('../../app/utils/env.server');

      expect(isProd()).toBe(false);
    });
  });
});
