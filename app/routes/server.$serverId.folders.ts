import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { serverContainer } from '../container/container.server';
import { FoldersService } from '../folders/FoldersService.server';
import { authMiddleware, sessionContext } from '../middleware/middleware.server';

export const middleware = [authMiddleware];

export async function loader(
  { params, context }: LoaderFunctionArgs,
  foldersService: FoldersService = serverContainer[FoldersService.name],
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    return Response.json({ error: 'Server ID required' }, { status: 400 });
  }

  const folders = await foldersService.getFolders(session.publicId, serverId);

  return Response.json({
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      createdAt: f.createdAt.toISOString(),
      itemCount: f.items.length,
      items: f.items.getItems().map((item) => ({
        shortUrlId: item.shortUrlId,
        shortCode: item.shortCode,
        addedAt: item.addedAt.toISOString(),
      })),
    })),
  });
}

export async function action(
  { request, params, context }: ActionFunctionArgs,
  foldersService: FoldersService = serverContainer[FoldersService.name],
) {
  const session = context.get(sessionContext);
  const { serverId } = params;

  if (!serverId) {
    return Response.json({ error: 'Server ID required' }, { status: 400 });
  }

  const data = await request.json();
  const { action: actionType } = data;

  switch (actionType) {
    case 'create': {
      const { name, color } = data;
      if (!name) {
        return Response.json({ error: 'Folder name required' }, { status: 400 });
      }

      try {
        const folder = await foldersService.createFolder(session.publicId, serverId, {
          name,
          color,
        });

        return Response.json({
          success: true,
          folder: {
            id: folder.id,
            name: folder.name,
            color: folder.color,
            createdAt: folder.createdAt.toISOString(),
          },
        });
      } catch (e: any) {
        return Response.json({ error: e.message }, { status: 400 });
      }
    }

    case 'update': {
      const { folderId, name, color } = data;
      if (!folderId) {
        return Response.json({ error: 'Folder ID required' }, { status: 400 });
      }

      const folder = await foldersService.updateFolder(folderId, session.publicId, serverId, {
        name,
        color,
      });

      if (!folder) {
        return Response.json({ error: 'Folder not found' }, { status: 404 });
      }

      return Response.json({ success: true });
    }

    case 'delete': {
      const { folderId } = data;
      if (!folderId) {
        return Response.json({ error: 'Folder ID required' }, { status: 400 });
      }

      const deleted = await foldersService.deleteFolder(folderId, session.publicId, serverId);

      if (!deleted) {
        return Response.json({ error: 'Folder not found' }, { status: 404 });
      }

      return Response.json({ success: true });
    }

    case 'addItem': {
      const { folderId, shortUrlId, shortCode } = data;
      if (!folderId || !shortUrlId || !shortCode) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const item = await foldersService.addToFolder(folderId, session.publicId, serverId, {
        shortUrlId,
        shortCode,
      });

      if (!item) {
        return Response.json({ error: 'Folder not found' }, { status: 404 });
      }

      return Response.json({ success: true });
    }

    case 'removeItem': {
      const { folderId, shortUrlId } = data;
      if (!folderId || !shortUrlId) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const removed = await foldersService.removeFromFolder(
        folderId,
        session.publicId,
        serverId,
        shortUrlId,
      );

      if (!removed) {
        return Response.json({ error: 'Item not found' }, { status: 404 });
      }

      return Response.json({ success: true });
    }

    case 'getFoldersForUrl': {
      const { shortUrlId } = data;
      if (!shortUrlId) {
        return Response.json({ error: 'Short URL ID required' }, { status: 400 });
      }

      const folders = await foldersService.getFoldersForShortUrl(
        session.publicId,
        serverId,
        shortUrlId,
      );

      return Response.json({
        folders: folders.map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color,
        })),
      });
    }

    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 });
  }
}
