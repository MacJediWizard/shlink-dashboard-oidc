import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { serverContainer } from '../container/container.server';
import { FavoritesService } from '../favorites/FavoritesService.server';
import { authMiddleware, sessionContext } from '../middleware/middleware.server';

export const middleware = [authMiddleware];

export async function loader(
  { params, context }: LoaderFunctionArgs,
  favoritesService: FavoritesService = serverContainer[FavoritesService.name],
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    return Response.json({ error: 'Server ID required' }, { status: 400 });
  }

  const favorites = await favoritesService.getFavorites(session.publicId, serverId);

  return Response.json({
    favorites: favorites.map((f) => ({
      shortUrlId: f.shortUrlId,
      shortCode: f.shortCode,
      longUrl: f.longUrl,
      title: f.title,
      notes: f.notes,
      createdAt: f.createdAt.toISOString(),
    })),
  });
}

export async function action(
  { request, params, context }: ActionFunctionArgs,
  favoritesService: FavoritesService = serverContainer[FavoritesService.name],
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    return Response.json({ error: 'Server ID required' }, { status: 400 });
  }

  const data = await request.json();
  const { action: actionType } = data;

  switch (actionType) {
    case 'add': {
      const { shortUrlId, shortCode, longUrl, title, notes } = data;
      if (!shortUrlId || !shortCode || !longUrl) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const favorite = await favoritesService.addFavorite(session.publicId, serverId, {
        shortUrlId,
        shortCode,
        longUrl,
        title,
        notes,
      });

      return Response.json({
        success: true,
        favorite: {
          shortUrlId: favorite.shortUrlId,
          shortCode: favorite.shortCode,
          longUrl: favorite.longUrl,
          title: favorite.title,
          notes: favorite.notes,
          createdAt: favorite.createdAt.toISOString(),
        },
      });
    }

    case 'remove': {
      const { shortUrlId } = data;
      if (!shortUrlId) {
        return Response.json({ error: 'Short URL ID required' }, { status: 400 });
      }

      const removed = await favoritesService.removeFavorite(session.publicId, serverId, shortUrlId);
      return Response.json({ success: removed });
    }

    case 'check': {
      const { shortUrlId } = data;
      if (!shortUrlId) {
        return Response.json({ error: 'Short URL ID required' }, { status: 400 });
      }

      const isFavorite = await favoritesService.isFavorite(session.publicId, serverId, shortUrlId);
      return Response.json({ isFavorite });
    }

    case 'updateNotes': {
      const { shortUrlId, notes } = data;
      if (!shortUrlId) {
        return Response.json({ error: 'Short URL ID required' }, { status: 400 });
      }

      const favorite = await favoritesService.updateFavoriteNotes(
        session.publicId,
        serverId,
        shortUrlId,
        notes ?? null,
      );

      if (!favorite) {
        return Response.json({ error: 'Favorite not found' }, { status: 404 });
      }

      return Response.json({ success: true });
    }

    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 });
  }
}
