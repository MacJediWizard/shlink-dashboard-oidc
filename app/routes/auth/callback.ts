import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { AuthHelper } from '../../auth/auth-helper.server';
import { exchangeCodeForTokens, isOidcEnabled } from '../../auth/oidc.server';
import { serverContainer } from '../../container/container.server';
import { UsersService } from '../../users/UsersService.server';

const OIDC_STATE_COOKIE = 'oidc_state';

export async function loader(
  { request }: LoaderFunctionArgs,
  authHelper: AuthHelper = serverContainer[AuthHelper.name],
  usersService: UsersService = serverContainer[UsersService.name],
) {
  if (!isOidcEnabled()) {
    return redirect('/login');
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Handle OIDC errors
  if (error) {
    console.error('OIDC error:', error, errorDescription);
    return redirect(`/login?error=${encodeURIComponent(errorDescription ?? error)}`);
  }

  if (!code || !state) {
    return redirect('/login?error=missing_code_or_state');
  }

  // Get OIDC state from cookie
  const cookieHeader = request.headers.get('cookie') ?? '';
  const oidcStateCookie = parseCookie(cookieHeader, OIDC_STATE_COOKIE);

  if (!oidcStateCookie) {
    return redirect('/login?error=missing_oidc_state');
  }

  let oidcState: { state: string; nonce: string; codeVerifier: string; redirectTo?: string };
  try {
    oidcState = JSON.parse(oidcStateCookie);
  } catch {
    return redirect('/login?error=invalid_oidc_state');
  }

  try {
    // Exchange code for tokens and get claims
    const claims = await exchangeCodeForTokens(
      code,
      state,
      oidcState.state,
      oidcState.nonce,
      oidcState.codeVerifier,
    );

    // Find or create user from OIDC claims
    const user = await usersService.findOrCreateFromOidcClaims(claims);

    // Create session and redirect
    const response = await authHelper.loginWithOidc(request, user, oidcState.redirectTo);

    // Clear the OIDC state cookie
    response.headers.append('Set-Cookie', `${OIDC_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

    return response;
  } catch (e: any) {
    console.error('OIDC callback error:', e);
    return redirect(`/login?error=${encodeURIComponent(e.message ?? 'oidc_callback_failed')}`);
  }
}

function parseCookie(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [cookieName, ...valueParts] = cookie.split('=');
    if (cookieName === name) {
      return decodeURIComponent(valueParts.join('='));
    }
  }
  return null;
}
