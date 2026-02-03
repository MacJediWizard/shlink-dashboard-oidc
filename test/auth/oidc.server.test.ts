import { generateOidcState, mapGroupsToRole } from '../../app/auth/oidc.server';

vi.mock('../../app/utils/env.server', () => ({
  isOidcEnabled: vi.fn(),
  getOidcConfig: vi.fn(),
}));

import { getOidcConfig, isOidcEnabled } from '../../app/utils/env.server';

const mockedIsOidcEnabled = vi.mocked(isOidcEnabled);
const mockedGetOidcConfig = vi.mocked(getOidcConfig);

describe('oidc.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateOidcState', () => {
    it('generates state, nonce, and codeVerifier', () => {
      const state = generateOidcState();

      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('nonce');
      expect(state).toHaveProperty('codeVerifier');
      expect(typeof state.state).toBe('string');
      expect(typeof state.nonce).toBe('string');
      expect(typeof state.codeVerifier).toBe('string');
      expect(state.state.length).toBeGreaterThan(0);
      expect(state.nonce.length).toBeGreaterThan(0);
      expect(state.codeVerifier.length).toBeGreaterThan(0);
    });

    it('generates unique values each time', () => {
      const state1 = generateOidcState();
      const state2 = generateOidcState();

      expect(state1.state).not.toEqual(state2.state);
      expect(state1.nonce).not.toEqual(state2.nonce);
      expect(state1.codeVerifier).not.toEqual(state2.codeVerifier);
    });
  });

  describe('mapGroupsToRole', () => {
    it('returns managed-user when OIDC is not enabled', () => {
      mockedGetOidcConfig.mockReturnValue(null);

      const role = mapGroupsToRole(['some-group']);

      expect(role).toBe('managed-user');
    });

    it('returns admin when user is in admin group', () => {
      mockedGetOidcConfig.mockReturnValue({
        issuerUrl: 'https://auth.example.com',
        clientId: 'client-id',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/auth/callback',
        scopes: 'openid profile email groups',
        adminGroup: 'shlink-admins',
        advancedGroup: 'shlink-advanced',
        defaultRole: 'managed-user',
      });

      const role = mapGroupsToRole(['some-group', 'shlink-admins']);

      expect(role).toBe('admin');
    });

    it('returns advanced-user when user is in advanced group but not admin', () => {
      mockedGetOidcConfig.mockReturnValue({
        issuerUrl: 'https://auth.example.com',
        clientId: 'client-id',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/auth/callback',
        scopes: 'openid profile email groups',
        adminGroup: 'shlink-admins',
        advancedGroup: 'shlink-advanced',
        defaultRole: 'managed-user',
      });

      const role = mapGroupsToRole(['some-group', 'shlink-advanced']);

      expect(role).toBe('advanced-user');
    });

    it('returns admin even when user is in both admin and advanced groups', () => {
      mockedGetOidcConfig.mockReturnValue({
        issuerUrl: 'https://auth.example.com',
        clientId: 'client-id',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/auth/callback',
        scopes: 'openid profile email groups',
        adminGroup: 'shlink-admins',
        advancedGroup: 'shlink-advanced',
        defaultRole: 'managed-user',
      });

      const role = mapGroupsToRole(['shlink-admins', 'shlink-advanced']);

      expect(role).toBe('admin');
    });

    it('returns default role when user is not in any configured group', () => {
      mockedGetOidcConfig.mockReturnValue({
        issuerUrl: 'https://auth.example.com',
        clientId: 'client-id',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/auth/callback',
        scopes: 'openid profile email groups',
        adminGroup: 'shlink-admins',
        advancedGroup: 'shlink-advanced',
        defaultRole: 'managed-user',
      });

      const role = mapGroupsToRole(['other-group']);

      expect(role).toBe('managed-user');
    });

    it('returns configured default role', () => {
      mockedGetOidcConfig.mockReturnValue({
        issuerUrl: 'https://auth.example.com',
        clientId: 'client-id',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/auth/callback',
        scopes: 'openid profile email groups',
        adminGroup: 'shlink-admins',
        advancedGroup: undefined,
        defaultRole: 'advanced-user',
      });

      const role = mapGroupsToRole([]);

      expect(role).toBe('advanced-user');
    });

    it('handles empty groups array', () => {
      mockedGetOidcConfig.mockReturnValue({
        issuerUrl: 'https://auth.example.com',
        clientId: 'client-id',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/auth/callback',
        scopes: 'openid profile email groups',
        adminGroup: 'shlink-admins',
        advancedGroup: 'shlink-advanced',
        defaultRole: 'managed-user',
      });

      const role = mapGroupsToRole([]);

      expect(role).toBe('managed-user');
    });

    it('handles undefined admin and advanced groups', () => {
      mockedGetOidcConfig.mockReturnValue({
        issuerUrl: 'https://auth.example.com',
        clientId: 'client-id',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/auth/callback',
        scopes: 'openid profile email groups',
        adminGroup: undefined,
        advancedGroup: undefined,
        defaultRole: 'managed-user',
      });

      const role = mapGroupsToRole(['some-group']);

      expect(role).toBe('managed-user');
    });
  });
});
