import { Outlet, redirect } from 'react-router';
import { Layout } from '../../common/Layout';
import { authMiddleware, ensureAdminMiddleware } from '../../middleware/middleware.server';
import { canManageLocalUsers } from '../../utils/env.server';

export const middleware = [authMiddleware, ensureAdminMiddleware];

export async function loader() {
  // Block access to user management when OIDC is the sole authentication provider
  if (!canManageLocalUsers()) {
    throw redirect('/');
  }
  return null;
}

export default function ManageUsers() {
  return (
    <Layout flexColumn>
      <Outlet />
    </Layout>
  );
}
