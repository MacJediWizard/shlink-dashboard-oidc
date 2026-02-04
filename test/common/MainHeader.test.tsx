import { screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { MemoryRouter } from 'react-router';
import type { SessionData } from '../../app/auth/session-context';
import { SessionProvider } from '../../app/auth/session-context';
import type { BrandingConfig } from '../../app/common/MainHeader';
import { MainHeader } from '../../app/common/MainHeader';
import { checkAccessibility } from '../__helpers__/accessibility';
import { renderWithEvents } from '../__helpers__/set-up-test';

describe('<MainHeader />', () => {
  const defaultBranding: BrandingConfig = { title: 'Shlink' };

  const setUp = (session: SessionData | null = null, branding: BrandingConfig = defaultBranding) => renderWithEvents(
    <SessionProvider value={session}>
      <MemoryRouter>
        <MainHeader branding={branding} />
      </MemoryRouter>
    </SessionProvider>,
  );

  it.each([
    [fromPartial<SessionData>({ displayName: 'Jane' })],
    [fromPartial<SessionData>({ username: 'jane' })],
  ])('passes a11y checks', (session) => checkAccessibility(setUp(session)));

  it.each([
    [undefined],
    [fromPartial<SessionData>({ displayName: 'Jane Doe' })],
    [fromPartial<SessionData>({ displayName: '', username: 'john_doe' })],
    [fromPartial<SessionData>({ username: 'john_doe' })],
  ])('shows user menu toggle only if session is set', (session) => {
    setUp(session);

    if (session) {
      expect(screen.getByTestId('user-menu')).toHaveTextContent(session.displayName || session.username);
    } else {
      expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
    }
  });

  it.each([
    {
      sessionData: fromPartial<SessionData>({ role: 'admin' }),
      shouldShowUsersMenu: true,
      shouldShowManageServers: true,
    },
    {
      sessionData: fromPartial<SessionData>({ role: 'advanced-user' }),
      shouldShowUsersMenu: false,
      shouldShowManageServers: true,
    },
    {
      sessionData: fromPartial<SessionData>({ role: 'managed-user' }),
      shouldShowUsersMenu: false,
      shouldShowManageServers: false,
    },
  ])('shows expected options depending on the user role', async (
    { sessionData, shouldShowUsersMenu, shouldShowManageServers },
  ) => {
    const { user } = setUp({ ...sessionData, displayName: 'Foo' });

    // Open menu
    await user.click(screen.getByRole('button', { name: 'Foo' }));

    if (shouldShowUsersMenu) {
      expect(screen.getByText('Manage users')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('Manage users')).not.toBeInTheDocument();
    }

    if (shouldShowManageServers) {
      expect(screen.getByText('Manage servers')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('Manage servers')).not.toBeInTheDocument();
    }
  });

  it('displays custom branding title', () => {
    setUp(null, { title: 'My Custom App' });
    expect(screen.getByText('My Custom App')).toBeInTheDocument();
  });

  it('displays default Shlink title when no custom branding', () => {
    setUp(null);
    expect(screen.getByText('Shlink')).toBeInTheDocument();
  });
});
