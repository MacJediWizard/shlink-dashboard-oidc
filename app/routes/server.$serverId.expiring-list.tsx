import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { authMiddleware } from '../middleware/middleware.server';

export const middleware = [authMiddleware];

// Redirect to the main expiring page
export function loader({ params }: LoaderFunctionArgs) {
  const { serverId } = params;
  if (!serverId) {
    throw new Response('Server ID required', { status: 400 });
  }
  return redirect(`/server/${serverId}/expiring`);
}
