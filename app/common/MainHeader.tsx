import {
  faArrowRightFromBracket as faLogout,
  faClock,
  faCogs,
  faFolder,
  faHistory,
  faServer,
  faStar,
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

interface NavBarMenuItemsProps {
  allowLocalUserManagement: boolean;
}

// Extract serverId from pathname like /server/{serverId}/*
const getServerIdFromPath = (pathname: string): string | null => {
  const match = pathname.match(/^\/server\/([^/]+)/);
  return match ? match[1] : null;
};

const NavBarMenuItems: FC<NavBarMenuItemsProps> = ({ allowLocalUserManagement }) => {
  const session = useSession();
  const { pathname } = useLocation();
  const serverId = getServerIdFromPath(pathname);

  if (!session) {
    return null;
  }

  return (
    <>
      {/* Server features menu - shown when viewing a server */}
      {serverId && (
        <NavBar.Dropdown
          buttonContent={(
            <span className="flex items-center gap-1.5" data-testid="server-features-menu">
              <FontAwesomeIcon icon={faServer} />
              <span className="whitespace-nowrap">Server Tools</span>
            </span>
          )}
        >
          <Dropdown.Item
            to={`/server/${serverId}/favorites-list`}
            selected={pathname.includes('/favorites-list')}
          >
            <FontAwesomeIcon icon={faStar} className="mr-0.5" /> Favorites
          </Dropdown.Item>
          <Dropdown.Item
            to={`/server/${serverId}/folders-list`}
            selected={pathname.includes('/folders-list')}
          >
            <FontAwesomeIcon icon={faFolder} className="mr-0.5" /> Folders
          </Dropdown.Item>
          <Dropdown.Item
            to={`/server/${serverId}/expiring`}
            selected={pathname.includes('/expiring')}
          >
            <FontAwesomeIcon icon={faClock} className="mr-0.5" /> Expiring URLs
          </Dropdown.Item>
        </NavBar.Dropdown>
      )}

      {session.role === 'admin' && (
        <>
          {/* Only show Manage users when local user management is allowed */}
          {allowLocalUserManagement && (
            <NavBar.MenuItem
              to="/manage-users/1"
              active={pathname.startsWith('/manage-users')}
              className="flex items-center gap-1.5"
            >
              <FontAwesomeIcon icon={faUsers} />
              <span className="whitespace-nowrap">Manage users</span>
            </NavBar.MenuItem>
          )}
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
  allowLocalUserManagement: boolean;
}

export const MainHeader: FC<MainHeaderProps> = ({ branding, allowLocalUserManagement }) => {
  return (
    <NavBar
      className="[&]:fixed top-0 z-900"
      brand={(
        <Link to="" className="[&]:text-white no-underline flex gap-2 w-25">
          <ShlinkLogo className="w-[26px]" color="white" logoUrl={branding.logoUrl} /> {branding.title}
        </Link>
      )}
    >
      <NavBarMenuItems allowLocalUserManagement={allowLocalUserManagement} />
    </NavBar>
  );
};
