import {
  faArrowRightFromBracket as faLogout,
  faCogs,
  faHistory,
  faServer,
  faUser,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Dropdown, NavBar } from '@shlinkio/shlink-frontend-kit';
import type { FC } from 'react';
import { Link, useLocation } from 'react-router';
import { useSession } from '../auth/session-context';
import { ShlinkLogo } from './ShlinkLogo';

export interface BrandingConfig {
  title: string;
  logoUrl?: string;
  brandColor?: string;
}

const NavBarMenuItems: FC = () => {
  const session = useSession();
  const { pathname } = useLocation();

  if (!session) {
    return null;
  }

  return (
    <>
      {session.role === 'admin' && (
        <>
          <NavBar.MenuItem
            to="/manage-users/1"
            active={pathname.startsWith('/manage-users')}
            className="flex items-center gap-1.5"
          >
            <FontAwesomeIcon icon={faUsers} />
            <span className="whitespace-nowrap">Manage users</span>
          </NavBar.MenuItem>
          <NavBar.MenuItem
            to="/admin/audit-log"
            active={pathname.startsWith('/admin/audit-log')}
            className="flex items-center gap-1.5"
          >
            <FontAwesomeIcon icon={faHistory} />
            <span className="whitespace-nowrap">Audit log</span>
          </NavBar.MenuItem>
        </>
      )}
      <NavBar.Dropdown
        buttonContent={(
          <span className="flex items-center gap-1.5" data-testid="user-menu">
            <FontAwesomeIcon icon={faUser} />
            <span className="whitespace-nowrap">{session.displayName || session.username}</span>
          </span>
        )}
      >
        <Dropdown.Item to="/profile" selected={pathname === '/profile'}>
          <FontAwesomeIcon icon={faUser} className="mr-0.5" /> My profile
        </Dropdown.Item>
        <Dropdown.Item to="/settings" selected={pathname.startsWith('/settings')}>
          <FontAwesomeIcon icon={faCogs} className="mr-0.5" /> My settings
        </Dropdown.Item>
        {session.role !== 'managed-user' && (
          <>
            <Dropdown.Separator />
            <Dropdown.Item to="/manage-servers/1" selected={pathname.startsWith('/manage-servers')}>
              <FontAwesomeIcon icon={faServer} className="mr-0.5" /> Manage servers
            </Dropdown.Item>
          </>
        )}
        <Dropdown.Separator />
        <Dropdown.Item to="/logout">
          <FontAwesomeIcon icon={faLogout} className="mr-0.5" /> Logout
        </Dropdown.Item>
      </NavBar.Dropdown>
    </>
  );
};

export interface MainHeaderProps {
  branding: BrandingConfig;
}

export const MainHeader: FC<MainHeaderProps> = ({ branding }) => {
  return (
    <NavBar
      className="[&]:fixed top-0 z-900"
      brand={(
        <Link to="" className="[&]:text-white no-underline flex gap-2 w-25">
          <ShlinkLogo className="w-[26px]" color="white" logoUrl={branding.logoUrl} /> {branding.title}
        </Link>
      )}
    >
      <NavBarMenuItems />
    </NavBar>
  );
};
