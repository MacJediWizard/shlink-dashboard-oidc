import { fromPartial } from '@total-typescript/shoehorn';
import type { LoaderFunctionArgs } from 'react-router';
import type { AuthHelper } from '../../app/auth/auth-helper.server';
import { loader as logoutLoader } from '../../app/routes/logout';

vi.mock('../../app/auth/oidc.server', () => ({
  isOidcEnabled: vi.fn(),
  getLogoutUrl: vi.fn(),
}));

import { getLogoutUrl, isOidcEnabled } from '../../app/auth/oidc.server';

const mockedIsOidcEnabled = vi.mocked(isOidcEnabled);
const mockedGetLogoutUrl = vi.mocked(getLogoutUrl);

describe('logout', () => {
  const logout = vi.fn();
  const authHelper = fromPartial<AuthHelper>({ logout });

  const buildRequest = () => fromPartial<Request>({
    headers: new Headers(),
  });

  const buildLoaderArgs = (request: Request): LoaderFunctionArgs => fromPartial({
    request,
    context: new Map(),
    params: {},
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs out and returns local logout response when OIDC is disabled', async () => {
    mockedIsOidcEnabled.mockReturnValue(false);
    const mockResponse = new Response(null, {
      status: 302,
      headers: { Location: '/login', 'Set-Cookie': 'session=; Max-Age=0' },
    });
    logout.mockResolvedValue(mockResponse);

    const request = buildRequest();
    const response = await logoutLoader(buildLoaderArgs(request), authHelper);

    expect(logout).toHaveBeenCalledWith(request);
    expect(response).toBe(mockResponse);
  });

  it('logs out and returns local logout response when OIDC has no logout URL', async () => {
    mockedIsOidcEnabled.mockReturnValue(true);
    mockedGetLogoutUrl.mockResolvedValue(null);

    const mockResponse = new Response(null, {
      status: 302,
      headers: { Location: '/login', 'Set-Cookie': 'session=; Max-Age=0' },
    });
    logout.mockResolvedValue(mockResponse);

    const request = buildRequest();
    const response = await logoutLoader(buildLoaderArgs(request), authHelper);

    expect(logout).toHaveBeenCalledWith(request);
    expect(response).toBe(mockResponse);
  });

  it('redirects to OIDC logout URL when available', async () => {
    mockedIsOidcEnabled.mockReturnValue(true);
    mockedGetLogoutUrl.mockResolvedValue('https://auth.example.com/logout?redirect=https://app.example.com/login');

    const mockResponse = new Response(null, {
      status: 302,
      headers: { Location: '/login', 'Set-Cookie': 'session=; Max-Age=0' },
    });
    logout.mockResolvedValue(mockResponse);

    const request = buildRequest();
    const response = await logoutLoader(buildLoaderArgs(request), authHelper);

    expect(logout).toHaveBeenCalledWith(request);
    expect(response.headers.get('Location')).toBe('https://auth.example.com/logout?redirect=https://app.example.com/login');
    expect(response.headers.get('Set-Cookie')).toBe('session=; Max-Age=0');
  });

  it('preserves Set-Cookie header when redirecting to OIDC logout', async () => {
    mockedIsOidcEnabled.mockReturnValue(true);
    mockedGetLogoutUrl.mockResolvedValue('https://auth.example.com/logout');

    const mockResponse = new Response(null, {
      status: 302,
      headers: { Location: '/login', 'Set-Cookie': 'shlink_dashboard_session=; Path=/; Max-Age=0' },
    });
    logout.mockResolvedValue(mockResponse);

    const request = buildRequest();
    const response = await logoutLoader(buildLoaderArgs(request), authHelper);

    expect(response.headers.get('Set-Cookie')).toBe('shlink_dashboard_session=; Path=/; Max-Age=0');
  });
});
