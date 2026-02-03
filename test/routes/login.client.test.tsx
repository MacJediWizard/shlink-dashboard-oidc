import { screen, waitFor } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import Login from '../../app/routes/login';
import { renderWithEvents } from '../__helpers__/set-up-test';

describe('login', () => {
  describe('<Login />', () => {
    const setUp = (
      error: boolean | { error: boolean; message?: string } = false,
      oidcEnabled: boolean = false,
      localAuthEnabled: boolean = true,
      oidcProviderName: string = 'SSO',
      searchParams: string = '',
    ) => {
      const Stub = createRoutesStub([
        {
          path: '/',
          Component: Login,
          loader: () => ({ oidcEnabled, localAuthEnabled, oidcProviderName }),
          action: () => (typeof error === 'boolean' ? { error } : error),
        },
      ]);
      return renderWithEvents(<Stub initialEntries={[`/${searchParams}`]} />);
    };

    it('renders expected form controls', async () => {
      setUp();

      await waitFor(() => expect(screen.getByLabelText('Username:')).toBeInTheDocument());
      expect(screen.getByLabelText('Password:')).toBeInTheDocument();
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    });

    it('shows loading state while logging in', async () => {
      const { user } = setUp(true);

      await waitFor(() => expect(screen.getByLabelText('Username:')).toBeInTheDocument());

      // Submit form with data
      await user.type(screen.getByLabelText('Username:'), 'incorrect');
      await user.type(screen.getByLabelText('Password:'), 'incorrect');
      // Do not wait for submit to finish, as the loading state will be reset afterward
      const loginPromise = user.click(screen.getByRole('button', { name: 'Login' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Logging in...' })).toBeInTheDocument());
      await loginPromise;
    });

    it('renders error when present', async () => {
      const { user } = setUp(true);

      await waitFor(() => expect(screen.getByLabelText('Username:')).toBeInTheDocument());

      // Submit form with data
      await user.type(screen.getByLabelText('Username:'), 'incorrect');
      await user.type(screen.getByLabelText('Password:'), 'incorrect');
      await user.click(screen.getByRole('button', { name: 'Login' }));

      await waitFor(() => expect(screen.getByText('Username or password are incorrect')).toBeInTheDocument());
    });

    it('shows SSO button when OIDC is enabled', async () => {
      setUp(false, true, true, 'Authentik');

      await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in with Authentik' })).toBeInTheDocument());
      expect(screen.getByLabelText('Username:')).toBeInTheDocument();
    });

    it('shows separator when both OIDC and local auth are enabled', async () => {
      setUp(false, true, true);

      await waitFor(() => expect(screen.getByText('or')).toBeInTheDocument());
    });

    it('hides local auth form when only OIDC is enabled', async () => {
      setUp(false, true, false);

      await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in with SSO' })).toBeInTheDocument());
      expect(screen.queryByLabelText('Username:')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Password:')).not.toBeInTheDocument();
    });

    it('shows error from URL params', async () => {
      setUp(false, false, true, 'SSO', '?error=Authentication%20failed');

      await waitFor(() => expect(screen.getByText(/Authentication error:/)).toBeInTheDocument());
      expect(screen.getByText(/Authentication failed/)).toBeInTheDocument();
    });

    it('shows custom error message when provided', async () => {
      const { user } = setUp({ error: true, message: 'OIDC is not enabled' });

      await waitFor(() => expect(screen.getByLabelText('Username:')).toBeInTheDocument());

      await user.type(screen.getByLabelText('Username:'), 'test');
      await user.type(screen.getByLabelText('Password:'), 'test');
      await user.click(screen.getByRole('button', { name: 'Login' }));

      await waitFor(() => expect(screen.getByText('OIDC is not enabled')).toBeInTheDocument());
    });

    it('includes redirect-to hidden input when present in search params', async () => {
      setUp(false, true, true, 'SSO', '?redirect-to=/dashboard');

      await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in with SSO' })).toBeInTheDocument());
      const redirectInput = document.querySelector('input[name="redirect-to"]') as HTMLInputElement;
      expect(redirectInput).toBeInTheDocument();
      expect(redirectInput.value).toBe('/dashboard');
    });
  });
});
