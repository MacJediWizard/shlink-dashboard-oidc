import { parse as parseCookies } from 'cookie';
import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { AuthHelper } from '../../auth/auth-helper.server';
import { exchangeCodeForTokens, isOidcEnabled } from '../../auth/oidc.server';
import { serverContainer } from '../../container/container.server';
import { UsersService } from '../../users/UsersService.server';
import { isProd } from '../../utils/env.server';
import { createLogger } from '../../utils/logger.server';

const logger = createLogger('OIDC');

const OIDC_STATE_COOKIE = 'oidc_state';

// Generic error message to prevent information disclosure
const GENERIC_AUTH_ERROR = 'Authentication failed. Please try again.';

function buildClearOidcStateCookie(): string {
  const secureFlag = isProd() ? 'Secure; ' : '';
  return `${OIDC_STATE_COOKIE}=; Path=/; ${secureFlag}HttpOnly; SameSite=Lax; Max-Age=0`;
}

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

  // Handle OIDC errors - log details but return generic message
  if (error) {
    logger.error('Provider returned error', { error, errorDescription });
    return redirect(`/login?error=${encodeURIComponent(GENERIC_AUTH_ERROR)}`);
  }

  if (!code || !state) {
    logger.error('Callback missing code or state');
    return redirect(`/login?error=${encodeURIComponent(GENERIC_AUTH_ERROR)}`);
  }

  // Get OIDC state from cookie using standard cookie parser
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = parseCookies(cookieHeader);
  const oidcStateCookie = cookies[OIDC_STATE_COOKIE];

  if (!oidcStateCookie) {
    logger.error('State cookie missing');
    return redirect(`/login?error=${encodeURIComponent(GENERIC_AUTH_ERROR)}`);
  }

  let oidcState: { state: string; nonce: string; codeVerifier: string; redirectTo?: string };
  try {
    oidcState = JSON.parse(oidcStateCookie);
  } catch {
    logger.error('Failed to parse state cookie');
    return redirect(`/login?error=${encodeURIComponent(GENERIC_AUTH_ERROR)}`);
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
    response.headers.append('Set-Cookie', buildClearOidcStateCookie());

    return response;
  } catch (e: any) {
    // Log detailed error for debugging, but return generic message to user
    logger.error('Callback error', { message: e.message, stack: e.stack });
    return redirect(`/login?error=${encodeURIComponent(GENERIC_AUTH_ERROR)}`);
  }
}
