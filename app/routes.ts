import type { RouteConfig } from '@react-router/dev/routes';
import { index, layout, prefix, route } from '@react-router/dev/routes';

export default [
  index('./routes/index/home.tsx'),
  route('/login', './routes/login.tsx'),
  route('/logout', './routes/logout.ts'),
  route('/auth/callback', './routes/auth/callback.ts'),
  route('/change-password', './routes/change-password.tsx'),
  route('/profile', './routes/profile/profile.tsx'),
  route('/settings/*', './routes/settings.tsx'),

  // Single server routes
  ...prefix('/server/:serverId/', [
    route('shlink-api/:method', './routes/shlink-api-rpc-proxy.ts'),
    route('tags/colors', './routes/save-tags-colors.ts'),
    route('favorites', './routes/server.$serverId.favorites.ts'),
    route('favorites-list', './routes/server.$serverId.favorites-list.tsx'),
    route('folders', './routes/server.$serverId.folders.ts'),
    route('folders-list', './routes/server.$serverId.folders-list.tsx'),
    route('expiring', './routes/server.$serverId.expiring.tsx'),
    route('expiring-list', './routes/server.$serverId.expiring-list.tsx'),
    route('*', './routes/shlink-component-wrapper.tsx'),
  ]),

  // Users management
  layout('routes/users/manage-users.tsx', prefix('/manage-users', [
    route('create', './routes/users/create-user.tsx'),
    route('delete', './routes/users/delete-user.ts'),
    ...prefix(':userPublicId', [
      route('edit', './routes/users/edit-user.tsx'),
      route('edit-servers', './routes/users/edit-user-servers.tsx'),
      route('reset-password', './routes/users/reset-user-password.tsx'),
    ]),
    route(':page', './routes/users/list-users.tsx'),
  ])),

  // Server management
  layout('./routes/servers/manage-servers.tsx', prefix('/manage-servers', [
    route('create', './routes/servers/create-server.tsx'),
    route('delete', './routes/servers/delete-server.ts'),
    route(':serverPublicId/edit', './routes/servers/edit-server.tsx'),
    route(':page', './routes/servers/list-servers.tsx'),
  ])),

  // Admin routes
  ...prefix('/admin', [
    route('audit-log/:page?', './routes/admin/audit-log.tsx'),
  ]),
] satisfies RouteConfig;
