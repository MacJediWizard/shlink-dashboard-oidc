import { render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { createRoutesStub } from 'react-router';
import { SessionProvider } from '../../../app/auth/session-context';
import Profile from '../../../app/routes/profile/profile';

describe('profile', () => {
  describe('<Profile />', () => {
    const setUp = (isOidcUser = false, displayName?: string) => {
      const path = '/profile';
      const Stub = createRoutesStub([{
        path,
        Component: Profile,
        HydrateFallback: () => null,
      }]);

      return render(
        <SessionProvider value={fromPartial({
          isOidcUser,
          displayName,
          username: 'testuser',
          role: 'admin',
        })}>
          <Stub initialEntries={[path]} />
        </SessionProvider>,
      );
    };

    it('renders both forms for local auth users', async () => {
      setUp(false);

      expect(screen.getByText('Edit profile')).toBeInTheDocument();
      expect(screen.getByText('Change password')).toBeInTheDocument();
    });

    it('renders read-only profile for OIDC users', async () => {
      setUp(true, 'Test User');

      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText(/Your profile is managed by your identity provider/)).toBeInTheDocument();
      expect(screen.queryByText('Edit profile')).not.toBeInTheDocument();
      expect(screen.queryByText('Change password')).not.toBeInTheDocument();
    });

    it('displays user info for OIDC users', async () => {
      setUp(true, 'John Doe');

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    it('shows "Not set" when OIDC user has no display name', async () => {
      setUp(true, undefined);

      expect(screen.getByText('Not set')).toBeInTheDocument();
    });
  });
});
